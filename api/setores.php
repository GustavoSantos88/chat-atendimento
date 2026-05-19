<?php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['atendente_id'])) {
    http_response_code(403);
    echo json_encode(['erro' => 'Não autenticado']);
    exit;
}

require_once '../classes/Database.php';
$pdo = Database::getConn();

$stmt = $pdo->prepare("SELECT id, nome FROM setores WHERE status = 'ativo' ORDER BY nome");
$stmt->execute();
$setores = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($setores);
