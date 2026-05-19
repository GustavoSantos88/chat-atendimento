<?php
// ini_set('display_errors', 1);
// ini_set('log_errors', 1);
// error_reporting(E_ALL);

// ini_set('error_log', '/var/www/html/chat-atendimento/api/php_errors.log');
// LOG para depuração
// file_put_contents(__DIR__ . '/webhook.log', date('Y-m-d H:i:s') . ' - ' . file_get_contents('php://input') . PHP_EOL, FILE_APPEND);

require_once '../config/app.php';
require_once '../classes/Database.php';
require_once '../classes/WebhookHandler.php';

$input = json_decode(file_get_contents('php://input'), true);
if ($input) {
    WebhookHandler::processar($input);
    http_response_code(200);
} else {
    http_response_code(400);
}
