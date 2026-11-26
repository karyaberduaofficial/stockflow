<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DemandForecast;
use App\Models\ReorderRecommendation;
use App\Services\AnalyticsService;
use App\Services\AuditLogger;
use App\Services\DocumentExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AnalyticsExportController extends Controller
{
    public function __construct(
        private readonly AnalyticsService $analytics,
        private readonly DocumentExportService $exporter
    ) {}

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->analytics->dashboardForUser($request->user()),
        ]);
    }

    public function forecasts(): JsonResponse
    {
        return response()->json([
            'data' => DemandForecast::with('product')->orderByDesc('id')->limit(100)->get(),
        ]);
    }

    public function generateForecasts(Request $request): JsonResponse
    {
        $window = (int) $request->input('window_months', 3);

        return response()->json([
            'data' => $this->analytics->generateForecastsAndReorders(max(1, min(12, $window))),
        ], 201);
    }

    public function reorderRecommendations(): JsonResponse
    {
        return response()->json([
            'data' => ReorderRecommendation::with(['product', 'warehouse'])->orderByDesc('id')->limit(100)->get(),
        ]);
    }

    public function export(Request $request, string $report, string $format): BinaryFileResponse|JsonResponse
    {
        $rep = strtolower(trim($report));
        $fmt = strtolower(trim($format));

        if (! $this->exporter->canAccessReport($request->user(), $rep)) {
            AuditLogger::logForbidden(
                $request,
                "Role {$request->user()->primary_role} attempted unauthorized export of {$rep}.{$fmt}.",
                'exports'
            );

            return response()->json([
                'message' => 'Forbidden: your role is not permitted to export this report.',
                'error_code' => 'EXPORT_FORBIDDEN',
            ], 403);
        }

        $result = $this->exporter->generate($rep, $fmt);

        AuditLogger::log('DOCUMENT_EXPORTED', 'exports', 'info', $request->user(), $request, null, null, null, null, [
            'report' => $rep,
            'format' => $fmt,
            'filename' => $result['filename'],
        ]);

        return response()
            ->download($result['path'], $result['filename'], ['Content-Type' => $result['mime_type']])
            ->deleteFileAfterSend(true);
    }
}
