<?php
class Mensagem
{
    public static function salvar(int $atendimentoId, string $sessionId, string $remetente, string $direcao, string $tipo, string $texto, ?string $arquivo, ?string $dataEnvio = null, ?string $atendenteNome = null)
    {
        $pdo = Database::getConn();
        if (!$dataEnvio) $dataEnvio = date('Y-m-d H:i:s');
        $stmt = $pdo->prepare("INSERT INTO mensagens (atendimento_id, session_id, remetente_tipo, atendente_nome, direcao, tipo, mensagem, arquivo, data_envio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$atendimentoId, $sessionId, $remetente, $atendenteNome, $direcao, $tipo, $texto, $arquivo, $dataEnvio]);
        return $pdo->lastInsertId();
    }
}
