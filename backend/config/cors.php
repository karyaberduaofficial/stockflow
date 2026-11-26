<?php

$frontendOrigins = array_values(array_filter(array_map(
    static fn (string $origin): string => rtrim(trim($origin), '/'),
    explode(',', (string) env('FRONTEND_URL', 'http://localhost:5173'))
)));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $frontendOrigins ?: ['http://localhost:5173'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'Origin',
        'X-Requested-With',
        'X-XSRF-TOKEN',
        'X-Idempotency-Key',
    ],

    'exposed_headers' => ['Content-Disposition', 'X-StockFlow-Request-Id'],

    'max_age' => 3600,

    'supports_credentials' => true,
];
