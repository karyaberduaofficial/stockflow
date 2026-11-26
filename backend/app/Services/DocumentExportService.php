<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class DocumentExportService
{
    public const ALLOWED_REPORTS = [
        'inventory',
        'financial',
        'tax',
        'payroll',
        'invoice',
        'payslip',
        'opname',
        'executive_review',
    ];

    public const ALLOWED_FORMATS = ['pdf', 'docx', 'xlsx', 'pptx'];

    public const MIME_TYPES = [
        'pdf' => 'application/pdf',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    public const ROLE_REPORT_ACCESS = [
        'inventory' => ['admin', 'manager', 'warehouse', 'purchasing', 'finance'],
        'opname' => ['admin', 'manager', 'warehouse'],
        'financial' => ['admin', 'manager', 'finance'],
        'tax' => ['admin', 'manager', 'finance'],
        'payroll' => ['admin', 'manager', 'finance', 'hr_payroll'],
        'invoice' => ['admin', 'manager', 'sales', 'finance'],
        'payslip' => ['admin', 'manager', 'warehouse', 'purchasing', 'sales', 'finance', 'hr_payroll'],
        'executive_review' => ['admin', 'manager'],
    ];

    public function canAccessReport(User $user, string $report): bool
    {
        $allowedRoles = self::ROLE_REPORT_ACCESS[$report] ?? [];

        return $user->hasAnyRole($allowedRoles);
    }

    /**
     * Invoke `document-service/generate_export.py` safely using argument array (zero shell injection!).
     *
     * @return array{path: string, filename: string, mime_type: string}
     */
    public function generate(string $report, string $format, ?array $payload = null): array
    {
        $rep = strtolower(trim($report));
        $fmt = strtolower(trim($format));

        if (! in_array($rep, self::ALLOWED_REPORTS, true)) {
            throw ValidationException::withMessages(['report' => ["Unsupported report type: {$report}."] ]);
        }
        if (! in_array($fmt, self::ALLOWED_FORMATS, true)) {
            throw ValidationException::withMessages(['format' => ["Unsupported export format: {$format}."] ]);
        }

        $scriptPath = base_path(config('services.document_service.script_path', '../document-service/generate_export.py'));
        $pythonBin = config('services.document_service.python_bin', 'python');

        if (! is_file($scriptPath)) {
            throw ValidationException::withMessages([
                'export' => ['Document export generator script is unavailable.'],
            ]);
        }

        $tmpDir = storage_path('app/exports');
        if (! is_dir($tmpDir)) {
            mkdir($tmpDir, 0755, true);
        }

        $filename = sprintf('StockFlow_%s_%s.%s', Str::studly($rep), now()->format('Ymd_His'), $fmt);
        $outputPath = $tmpDir.DIRECTORY_SEPARATOR.$filename;
        $inputPath = null;

        $command = [
            $pythonBin,
            $scriptPath,
            '--report', $rep,
            '--format', $fmt,
            '--output', $outputPath,
        ];

        if ($payload !== null) {
            $inputPath = $tmpDir.DIRECTORY_SEPARATOR.'payload_'.Str::random(12).'.json';
            file_put_contents($inputPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            $command[] = '--input';
            $command[] = $inputPath;
        }

        $process = new Process($command);
        $process->setTimeout(45);
        $process->run();

        if ($inputPath && is_file($inputPath)) {
            @unlink($inputPath);
        }

        if (! $process->isSuccessful() || ! is_file($outputPath)) {
            throw ValidationException::withMessages([
                'export' => ['Document generation failed: '.trim($process->getErrorOutput() ?: $process->getOutput())],
            ]);
        }

        return [
            'path' => $outputPath,
            'filename' => $filename,
            'mime_type' => self::MIME_TYPES[$fmt],
        ];
    }
}
