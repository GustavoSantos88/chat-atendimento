<?php
require_once 'Cliente.php';
require_once 'Atendimento.php';
require_once 'Mensagem.php';
require_once 'RoundRobin.php';
require_once 'Setor.php';
require_once '../config/app.php';

class WebhookHandler
{
    private static function log(string $msg)
    {
        file_put_contents(__DIR__ . '/../api/handler.log', date('Y-m-d H:i:s') . ' - ' . $msg . PHP_EOL, FILE_APPEND);
    }

    public static function processar(array $data)
    {
        self::log('Recebido: ' . json_encode($data));

        if (!isset($data['event_type']) || $data['event_type'] !== 'message.received') {
            self::log('Evento ignorado');
            return;
        }

        $sessionId   = $data['session_id'];
        $telefone    = $data['payload']['from'];
        $mensagem    = trim($data['payload']['body']);
        $timestamp   = $data['payload']['timestamp'];
        $contactName = $data['payload']['contact_name'] ?? null;

        self::log("Mensagem de $telefone: $mensagem");

        $pdo = Database::getConn();
        if (!$pdo) {
            self::log('ERRO: Sem conexão com o banco');
            return;
        }

        // Deduplicação
        $hash = md5($sessionId . $telefone . $mensagem . $timestamp);
        $stmt = $pdo->prepare("SELECT id FROM eventos_processados WHERE hash_evento = ?");
        $stmt->execute([$hash]);
        if ($stmt->fetch()) {
            self::log("Duplicada ignorada: $hash");
            return;
        }
        $stmt = $pdo->prepare("INSERT INTO eventos_processados (session_id, telefone, event_type, hash_evento) VALUES (?, ?, 'message.received', ?)");
        $stmt->execute([$sessionId, $telefone, $hash]);

        $cliente = Cliente::findOrCreate($telefone, $contactName);
        self::log('Cliente ID: ' . $cliente['id']);

        $atendimento = Atendimento::buscarAbertoPorCliente($telefone, $sessionId);
        self::log('Atendimento existente: ' . ($atendimento ? $atendimento['id'] : 'nenhum'));

        if ($atendimento) {
            $msgId = Mensagem::salvar($atendimento['id'], $sessionId, 'cliente', 'entrada', 'texto', $mensagem, null, date('Y-m-d H:i:s', $timestamp));
            self::log("Mensagem $msgId salva no atendimento {$atendimento['id']}");
            self::emitirEvento('novaMensagem', ['atendimento_id' => $atendimento['id'], 'mensagem' => $mensagem]);
        } else {
            $setorId = self::verificarMenu($mensagem);
            if ($setorId) {
                // Busca próximo atendente disponível para o setor escolhido
                $proximoAtendente = RoundRobin::proximoAtendente($setorId);
                $atendenteId = $proximoAtendente ? $proximoAtendente['id'] : null;

                // Opcional: Verificar se o atendente retornado realmente pertence ao setor (redundante, mas seguro)
                if ($atendenteId) {
                    $check = $pdo->prepare("SELECT 1 FROM atendente_setor WHERE atendente_id = ? AND setor_id = ?");
                    $check->execute([$atendenteId, $setorId]);
                    if (!$check->fetch()) {
                        self::log("ERRO: Atendente $atendenteId não pertence ao setor $setorId. Ignorando.");
                        $atendenteId = null;
                        $proximoAtendente = null;
                    }
                }

                $novo = Atendimento::criar($cliente['id'], $setorId, $sessionId, $atendenteId);
                self::log("Atendimento criado: {$novo['id']} - {$novo['protocolo']} - Setor: $setorId - Atendente: " . ($atendenteId ?? 'nenhum'));

                // Salva a mensagem que escolheu o setor
                Mensagem::salvar($novo['id'], $sessionId, 'cliente', 'entrada', 'texto', $mensagem, null, date('Y-m-d H:i:s', $timestamp));

                // $texto = $atendenteId ? "✅ Atendimento iniciado com {$proximoAtendente['nome']}. Envie sua mensagem." : "⏳ Você está na fila. Em breve será atendido.";
                $protocolo = $novo['protocolo'];
                $texto = $atendenteId
                    ? "✅ *Olá seja bem vindo!* \n\n*Protocolo: {$protocolo}* \nAtendimento iniciado com {$proximoAtendente['nome']}. \nEnvie sua mensagem."
                    : "⏳ *Olá seja bem vindo!* \n\n*Protocolo: {$protocolo}* criado. \nVocê está na fila. \nEm breve um atendente estará disponível.";

                self::enviarWhatsApp($sessionId, $telefone, $texto);

                $texto = $atendenteId
                    ? "✅ Olá seja bem vindo! \n\nProtocolo: {$protocolo} \nAtendimento iniciado com {$proximoAtendente['nome']}. \n\nEnvie sua mensagem."
                    : "⏳ Olá seja bem vindo! \n\nProtocolo: {$protocolo} criado. \nVocê está na fila. \nEm breve um atendente estará disponível.";

                Mensagem::salvar($novo['id'], $sessionId, 'sistema', 'saida', 'texto', $texto, null, date('Y-m-d H:i:s'));
                self::emitirEvento('novoAtendimento', ['atendimento' => $novo, 'setor_id' => $setorId]);
            } else {
                self::log('Nenhum setor reconhecido. Enviando menu...');
                $menu = self::montarMenuSetores();
                self::enviarWhatsApp($sessionId, $telefone, $menu);
                self::log('Menu enviado.');
            }
        }
    }

    private static function verificarMenu(string $msg)
    {
        self::log("Verificando menu: $msg");
        $setores = Setor::listarAtivos();
        foreach ($setores as $s) {
            if ($msg == $s['id'] || stripos($msg, $s['nome']) !== false) {
                self::log("Setor reconhecido: {$s['nome']} (ID {$s['id']})");
                return $s['id'];
            }
        }
        return false;
    }

    private static function montarMenuSetores()
    {
        $setores = Setor::listarAtivos();
        if (empty($setores)) return "❌ Nenhum setor disponível.";
        $menu = "📋 *Escolha um setor:*\n\n";
        foreach ($setores as $s) {
            $menu .= "➡️ {$s['id']} - {$s['nome']}\n";
        }
        $menu .= "\nResponda com o *número* do setor.";
        return $menu;
    }

    private static function enviarWhatsApp(string $sessionId, string $to, string $message): void
    {
        self::log(">>> INICIANDO ENVIO para $to");

        if (!function_exists('curl_init')) {
            self::log("ERRO: cURL não está instalado/habilitado no PHP");
            return;
        }

        $url = BASE_URL_API . 'api/send';
        $postData = [
            'sessionId' => $sessionId,
            'number'    => $to,
            'message'   => $message
        ];

        $jsonData = json_encode($postData);
        self::log("URL: $url");
        self::log("Dados: $jsonData");

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'X-API-KEY: ' . API_KEY
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        self::log("HTTP Code: $httpCode");
        self::log("Resposta: " . substr($response, 0, 500));
        if ($error) {
            self::log("cURL error: $error");
        }

        if ($httpCode == 200) {
            self::log("✅ Mensagem enviada com sucesso para $to");
        } else {
            self::log("❌ Falha no envio para $to");
        }
    }

    private static function emitirEvento(string $evento, array $dados): void
    {
        $ch = curl_init('http://localhost:3000/emit');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['event' => $evento, 'data' => $dados]));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 2);
        curl_exec($ch);
        curl_close($ch);
    }
}
