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

// Total de atendimentos finalizados no mês atual
$stmt = $pdo->prepare("SELECT COUNT(*) as total FROM atendimentos WHERE status = 'finalizado' AND MONTH(data_fechamento) = MONTH(NOW()) AND YEAR(data_fechamento) = YEAR(NOW())");
$stmt->execute();
$totalMes = (int)($stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0);

// Atendente que mais atendeu no mês
$stmt = $pdo->prepare("
    SELECT a.nome, COUNT(*) as total
    FROM atendimentos at
    JOIN atendentes a ON at.atendente_atual_id = a.id
    WHERE at.status = 'finalizado' AND MONTH(at.data_fechamento) = MONTH(NOW()) AND YEAR(at.data_fechamento) = YEAR(NOW())
    GROUP BY a.id
    ORDER BY total DESC
    LIMIT 1
");
$stmt->execute();
$topAtendente = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$topAtendente) {
    $topAtendente = ['nome' => 'Nenhum', 'total' => 0];
}

// Atendimentos por setor (últimos 30 dias)
$stmt = $pdo->prepare("
    SELECT s.nome as setor, COUNT(*) as total
    FROM atendimentos a
    JOIN setores s ON a.setor_id = s.id
    WHERE a.status = 'finalizado' AND a.data_fechamento >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY a.setor_id
    ORDER BY total DESC
");
$stmt->execute();
$setores = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Lista de atendentes (para gerenciamento)
$stmt = $pdo->prepare("SELECT id, nome, email, status, ativo FROM atendentes ORDER BY nome");
$stmt->execute();
$atendentes = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'totalMes' => $totalMes,
    'topAtendente' => $topAtendente,
    'setores' => $setores,
    'atendentes' => $atendentes
]);
