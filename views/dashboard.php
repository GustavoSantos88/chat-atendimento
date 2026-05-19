<?php
session_start();
if (!isset($_SESSION['atendente_id'])) header('Location: login.php');
require_once '../config/app.php';

$is_admin = ($_SESSION['atendente_id'] == 1);
if (!$is_admin) {
    header('Location: atendimento.php');
    exit;
}

// Se for requisição POST, serve apenas o conteúdo da aba
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['tab'])) {
    $tab = $_POST['tab'];
    if ($tab === 'admin') {
        include 'admin_content.php';
    } elseif ($tab === 'atendimento') {
        include 'chat_content.php';
    } elseif ($tab === 'manage') {
        include 'admin_manage.php';
    }
    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Chat Atendimento</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="../assets/css/styles.css" rel="stylesheet">
    <script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            margin: 0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .admin-menu {
            background: #075e54;
            padding: 10px 20px;
            display: flex;
            gap: 20px;
            border-bottom: 1px solid #128c7e;
        }

        .admin-menu button {
            background: transparent;
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            cursor: pointer;
            transition: background 0.2s;
            font-size: 1rem;
        }

        .admin-menu button.active,
        .admin-menu button:hover {
            background: #128c7e;
        }

        .content {
            height: calc(100vh - 55px);
            overflow: auto;
        }

        .whatsapp-container {
            height: 100%;
        }
    </style>
</head>

<body>
    <div class="admin-menu">
        <button id="btnAdmin" class="active" title="Dashboard de todos os setores e atendimentos">📊 Dashboard</button>
        <button id="btnAtendimento" title="Visualize todos os atendimentos">💬 Atendimento</button>
        <button id="btnManage" title="Gerencie todos os cadastros: Atendentes, Setores, etc...">⚙️ Gerenciar</button>
        <div style="flex:1"></div>
        <!-- Seletor de status (visível apenas para admin) -->
        <select id="filtroStatus" class="status-select" title="Todos os status" style="color: white; border-radius: 20px; padding: 5px 12px;background: #075e54; border: 1px solid #128c7e;">
            <option value="">Todos os status</option>
            <option value="fila">Fila</option>
            <option value="aberto">Aberto</option>
            <option value="transferido">Transferido</option>
            <option value="finalizado">Finalizado</option>
        </select>
        <!-- Seletor de setor (visível apenas para admin) -->
        <select id="filtroSetor" class="status-select" title="Todos os setores" style="color: white; border-radius: 20px; padding: 5px 12px;background: #075e54; border: 1px solid #128c7e;">
            <option value="">Todos os setores</option>
        </select>

        <div class="text-center p-2" style="color: white"> Olá, <?= $_SESSION['atendente_nome'] ?></div>

        <div class="text-center p-2">
            <a href="../api/logout.php" class="btn-logout" title="Sair">🚪</a>
        </div>
    </div>
    <div class="content" id="mainContent">
        <div class="text-center p-5">Carregando...</div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

    <!-- DEFINIÇÃO DAS VARIÁVEIS GLOBAIS -->
    <script>
        window.baseUrl = '<?= BASE_URL ?>';
        window.socketUrl = '<?= SOCKET_URL ?>';
        window.secretKey = '<?= API_KEY ?>';
        window.atendenteId = <?= json_encode($_SESSION['atendente_id']) ?>;
        window.atendenteNome = <?= json_encode($_SESSION['atendente_nome']) ?>;
    </script>

    <script src="../assets/js/toast.js"></script>
    <script src="../assets/js/utils.js"></script>
    <script src="../assets/js/dashboard.js"></script>
    <script src="../assets/js/dashboard_admin.js"></script>
    <script src="../assets/js/admin_manage.js"></script>
    <script>
        const contentDiv = document.getElementById('mainContent');
        const btnAdmin = document.getElementById('btnAdmin');
        const btnAtendimento = document.getElementById('btnAtendimento');
        const btnManage = document.getElementById('btnManage');

        // Função para carregar uma aba via POST
        function loadTab(tabName, activeButton, saveState = true) {
            // Atualiza botões ativos
            [btnAdmin, btnAtendimento, btnManage].forEach(btn => btn.classList.remove('active'));
            activeButton.classList.add('active');

            if (saveState) {
                localStorage.setItem('dashboardActiveTab', tabName);
            }

            // Controla a visibilidade dos filtros
            toggleFilters(tabName);

            // Mostra loading
            contentDiv.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div><br>Carregando...</div>';

            fetch(window.location.href, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: 'tab=' + encodeURIComponent(tabName)
                })
                .then(response => response.text())
                .then(html => {
                    contentDiv.innerHTML = html;
                    if (tabName === 'atendimento') {
                        if (typeof window.initChat === 'function') {
                            setTimeout(() => window.initChat(), 50);
                        }
                    } else if (tabName === 'admin') {
                        setTimeout(() => {
                            if (typeof window.initAdminDashboard === 'function') {
                                window.initAdminDashboard();
                            } else {
                                console.error('initAdminDashboard não definida');
                            }
                        }, 150);
                    } else if (tabName === 'manage') {
                        setTimeout(() => {
                            if (typeof window.initManage === 'function') {
                                window.initManage();
                            }
                        }, 150);
                    }
                })
                .catch(err => {
                    toast('Erro ao carregar conteúdo.', 'error');
                    contentDiv.innerHTML = '<div class="alert alert-danger">Erro ao carregar conteúdo.</div>';
                    console.error(err);
                });
        }

        const filtroSetor = document.getElementById('filtroSetor');
        if (filtroSetor) {
            filtroSetor.addEventListener('change', function() {
                if (typeof window.initChat === 'function') {
                    // Recarregar a lista de atendimentos na aba atual (se o chat estiver carregado)
                    carregarAtendimentos(); // essa função deve estar acessível globalmente
                } else {
                    // Se o chat não foi carregado (ex: na aba admin), não faz nada
                }
            });
        }

        // Esconde ou mostra os filtros conforme a aba
        function toggleFilters(tabName) {
            const filtroStatus = document.getElementById('filtroStatus');
            const filtroSetor = document.getElementById('filtroSetor');
            if (tabName === 'atendimento') {
                if (filtroStatus) filtroStatus.style.display = 'inline-block';
                if (filtroSetor) filtroSetor.style.display = 'inline-block';
            } else {
                if (filtroStatus) filtroStatus.style.display = 'none';
                if (filtroSetor) filtroSetor.style.display = 'none';
            }
        }

        // Eventos das abas
        if (btnAdmin) {
            btnAdmin.addEventListener('click', () => loadTab('admin', btnAdmin, true));
        }

        if (btnAtendimento) {
            btnAtendimento.addEventListener('click', () => loadTab('atendimento', btnAtendimento, true));
        }

        if (btnManage) {
            btnManage.addEventListener('click', () => loadTab('manage', btnManage, true));
        }

        // Restaurar a última aba ativa
        const lastActiveTab = localStorage.getItem('dashboardActiveTab');
        if (lastActiveTab === 'atendimento') {
            loadTab('atendimento', btnAtendimento, false);
        } else if (lastActiveTab === 'manage') {
            loadTab('manage', btnManage, false);
        } else {
            loadTab('admin', btnAdmin, false);
            localStorage.setItem('dashboardActiveTab', 'admin');
        }
    </script>
</body>

</html>