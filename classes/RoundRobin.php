<?php
class RoundRobin
{
    /**
     * Retorna o próximo atendente disponível para um determinado setor.
     * @param int $setorId
     * @return array|null
     */
    public static function proximoAtendente($setorId)
    {
        $pdo = Database::getConn();

        // 1. Obtém o último atendente usado neste setor
        $stmt = $pdo->prepare("SELECT ultimo_atendente_id FROM fila_setor WHERE setor_id = ?");
        $stmt->execute([$setorId]);
        $fila = $stmt->fetch();
        $ultimoId = $fila['ultimo_atendente_id'] ?? 0;

        // 2. Busca próximo atendente online, ativo, vinculado a este setor, com ID > ultimoId
        $sql = "SELECT a.* FROM atendentes a
                INNER JOIN atendente_setor s ON s.atendente_id = a.id
                WHERE s.setor_id = ? 
                  AND a.status = 'online' 
                  AND a.ativo = 1 
                  AND a.id > ?
                ORDER BY a.id ASC LIMIT 1";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$setorId, $ultimoId]);
        $proximo = $stmt->fetch();

        // 3. Se não encontrou, reinicia do início (menor ID)
        if (!$proximo) {
            $sql = "SELECT a.* FROM atendentes a
                    INNER JOIN atendente_setor s ON s.atendente_id = a.id
                    WHERE s.setor_id = ? 
                      AND a.status = 'online' 
                      AND a.ativo = 1
                    ORDER BY a.id ASC LIMIT 1";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$setorId]);
            $proximo = $stmt->fetch();
        }

        // 4. Se encontrou, atualiza o último atendente do setor
        if ($proximo) {
            $stmtUp = $pdo->prepare("INSERT INTO fila_setor (setor_id, ultimo_atendente_id) VALUES (?, ?)
                                     ON DUPLICATE KEY UPDATE ultimo_atendente_id = ?");
            $stmtUp->execute([$setorId, $proximo['id'], $proximo['id']]);

            // Log para depuração (opcional)
            error_log("RoundRobin: setor $setorId -> próximo atendente: {$proximo['id']} - {$proximo['nome']}");
        } else {
            error_log("RoundRobin: Nenhum atendente online/ativo para o setor $setorId");
        }

        return $proximo;
    }
}
