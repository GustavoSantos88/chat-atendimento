// dashboard.js - Versão com agrupamento por cliente, quebras de linha e divisores de atendimento
let socket = null;
let clientesList = [];
let currentClienteId = null;
let currentAtendimentoId = null;
let currentSessionId = null;
let currentProtocolo = null;
let currentTelefone = null;
let currentSetorId = null;
let currentStatus = null;
const atendimentoId = window.atendenteId;

// ========== FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO CHAT ==========
window.initChat = function () {
    if (socket && socket.connected) {
        socket.disconnect();
    }

    socket = io(window.socketUrl || 'http://localhost:3000', { transports: ['websocket', 'polling'] });
    socket.emit('joinAtendente', window.atendenteId);

    // ========== CONTROLE DA SIDEBAR ==========
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (menuToggle && sidebar) {
        const newMenuToggle = menuToggle.cloneNode(true);
        menuToggle.parentNode.replaceChild(newMenuToggle, menuToggle);
        const closeSidebar = () => {
            sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        };
        const openSidebar = () => {
            sidebar.classList.add('open');
            if (overlay) overlay.classList.add('active');
        };
        newMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (sidebar.classList.contains('open')) closeSidebar();
            else openSidebar();
        });
        if (overlay) {
            const newOverlay = overlay.cloneNode(true);
            overlay.parentNode.replaceChild(newOverlay, overlay);
            newOverlay.addEventListener('click', closeSidebar);
        }
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!sidebar.contains(e.target) && e.target !== newMenuToggle && !newMenuToggle.contains(e.target)) {
                    closeSidebar();
                }
            }
        });
    }

    // ========== ATUALIZAR STATUS DO ATENDENTE ==========
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) {
        const newStatusSelect = statusSelect.cloneNode(true);
        statusSelect.parentNode.replaceChild(newStatusSelect, statusSelect);
        newStatusSelect.addEventListener('change', function () {
            fetchWithToast(
                window.baseUrl + 'api/atendentes.php',
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: this.value })
                },
                `Status alterado para ${this.value}`,
                'Erro ao alterar status'
            );
        });
    }

    // ========== CONFIGURAÇÃO DOS FILTROS ==========
    function carregarSetores() {
        const select = document.getElementById('filtroSetor');
        if (!select) return;
        fetch(window.baseUrl + 'api/setores.php')
            .then(response => response.json())
            .then(data => {
                if (data.length) {
                    while (select.options.length > 1) select.remove(1);
                    data.forEach(setor => {
                        const option = document.createElement('option');
                        option.value = setor.id;
                        option.textContent = setor.nome;
                        select.appendChild(option);
                    });
                }
            })
            .catch(err => console.error('Erro ao carregar setores:', err));
    }

    function getFiltros() {
        const selectSetor = document.getElementById('filtroSetor');
        const selectStatus = document.getElementById('filtroStatus');
        let params = [];
        if (selectSetor && window.atendenteId == 1 && selectSetor.value) {
            params.push('setor_id=' + selectSetor.value);
        }
        if (selectStatus && window.atendenteId == 1 && selectStatus.value) {
            params.push('status=' + encodeURIComponent(selectStatus.value));
        }
        return params.length ? '?' + params.join('&') : '';
    }

    const filtroSetor = document.getElementById('filtroSetor');
    const filtroStatus = document.getElementById('filtroStatus');
    if (filtroSetor) {
        carregarSetores();
        filtroSetor.addEventListener('change', () => {
            if (typeof window.carregarAtendimentos === 'function') {
                window.carregarAtendimentos();
            }
        });
    }
    if (filtroStatus) {
        filtroStatus.addEventListener('change', () => {
            if (typeof window.carregarAtendimentos === 'function') {
                window.carregarAtendimentos();
            }
        });
    }

    // ========== FUNÇÕES DO CHAT ==========
    function carregarAtendimentos() {
        let url = window.baseUrl + 'api/atendimentos.php' + getFiltros();
        fetch(url)
            .then(res => res.json())
            .then(data => {
                clientesList = data;
                renderConversations(data);
                if (currentClienteId && !data.find(c => c.cliente_id == currentClienteId)) {
                    closeChat();
                }
            })
            .catch(err => toast('Erro ao carregar conversas', 'error'));
    }

    function renderConversations(conversations) {
        const container = document.getElementById('listaAtendimentos');
        if (!container) return;
        if (!conversations.length) {
            container.innerHTML = '<div class="text-muted text-center p-4">Nenhum cliente com atendimento</div>';
            return;
        }
        let html = '';
        conversations.forEach(cli => {
            const isActive = (currentClienteId == cli.cliente_id);
            const avatarText = cli.cliente_nome ? cli.cliente_nome.charAt(0).toUpperCase() : '?';
            html += `
                <div class="conversation-item ${isActive ? 'active' : ''}" 
                     data-cliente-id="${cli.cliente_id}"
                     data-nome="${escapeHtml(cli.cliente_nome)}"
                     data-telefone="${escapeHtml(cli.telefone)}"
                     data-ultimo-atendimento-id="${cli.ultimo_atendimento_id}"
                     data-ultimo-status="${cli.ultimo_status}"
                     data-setor-nome="${escapeHtml(cli.setor_nome)}"
                     data-ultimo-protocolo="${escapeHtml(cli.ultimo_protocolo)}"
                     data-ultima-data="${cli.ultima_data}">
                    <div class="avatar">${avatarText}</div>
                    <div class="conversation-info">
                        <div class="conversation-name">${escapeHtml(cli.cliente_nome)}</div>
                        <div class="conversation-lastmsg">Protocolo: ${escapeHtml(cli.ultimo_protocolo)}</div>
                        <div class="conversation-lastmsg">
                            ${escapeHtml(cli.setor_nome)} 
                            <span class="badge bg-secondary">${escapeHtml(cli.ultimo_status)}</span>
                        </div>
                    </div>
                    <div class="conversation-time">${formatTime(cli.ultima_data)}</div>
                </div>
            `;
        });
        container.innerHTML = html;
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.addEventListener('click', () => {
                const clienteId = el.dataset.clienteId;
                const nome = el.dataset.nome;
                const telefone = el.dataset.telefone;
                const ultimoAtendimentoId = el.dataset.ultimoAtendimentoId;
                const ultimoStatus = el.dataset.ultimoStatus;
                const setorNome = el.dataset.setorNome;
                const ultimoProtocolo = el.dataset.ultimoProtocolo;
                openChat(clienteId, nome, telefone, ultimoAtendimentoId, ultimoStatus, setorNome, ultimoProtocolo);
            });
        });
    }

    function formatTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function (m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function formatarMensagem(texto) {
        if (!texto) return '';
        // Escapa HTML primeiro (evita XSS)
        let msg = escapeHtml(texto);
        // Substitui quebras de linha por <br>
        msg = msg.replace(/\n/g, '<br>');
        // Substitui *texto* por <strong>texto</strong> (regex não greedy)
        msg = msg.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
        return msg;
    }

    // ========== RENDERIZAÇÃO DE MENSAGENS COM DIVISORES ==========
    function renderizarMensagens(messages) {
        const container = document.getElementById('messagesContainer');
        if (!messages.length) {
            container.innerHTML = '<div class="text-muted text-center">Nenhuma mensagem ainda</div>';
            return;
        }
        let html = '';
        let lastAtendimentoId = null;
        messages.forEach(msg => {
            const atendimentoId = msg.atendimento_id;
            const atendimentoStatus = msg.atendimento_status;
            if (atendimentoId !== lastAtendimentoId) {
                const protocolo = msg.protocolo;
                const dataAbertura = new Date(msg.atendimento_data_abertura).toLocaleString();
                const statusText = atendimentoStatus === 'finalizado' ? 'Finalizado' : (atendimentoStatus === 'aberto' ? 'Em andamento' : 'Transferido');
                const statusClass = atendimentoStatus === 'finalizado' ? 'divider-end' : (atendimentoStatus === 'aberto' ? 'divider-active' : 'divider-transfer');
                html += `
                    <div class="atendimento-divider ${statusClass}">
                        <hr>
                        <div class="divider-content">
                            <strong>📋 Atendimento #${escapeHtml(protocolo)}</strong><br>
                            Início: ${dataAbertura}<br>
                            Status: ${statusText}
                        </div>
                        <hr>
                    </div>
                `;
                lastAtendimentoId = atendimentoId;
            }
            const isSent = msg.remetente_tipo === 'atendente';
            let nomeHtml = '';
            if (isSent && msg.atendente_nome) {
                nomeHtml = `<div class="message-sender">${escapeHtml(msg.atendente_nome)}</div>`;
            }

            let mensagemTexto = formatarMensagem(msg.mensagem);

            html += `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div class="message-bubble">
                        ${nomeHtml}
                        ${mensagemTexto}
                    </div>
                </div>
                <div class="message-time ${isSent ? 'sent' : 'received'}">${formatTime(msg.data_envio)}</div>
            `;
        });
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    }

    // Busca atendimento ativo (aberto ou transferido) para o cliente
    function buscarAtendimentoAtivo(clienteId) {
        return fetch(`${window.baseUrl}api/atendimentos.php?action=get_ativo_por_cliente&cliente_id=${clienteId}`)
            .then(res => res.json())
            .then(data => data.atendimento_id || null)
            .catch(() => null);
    }

    function carregarMensagensPorCliente(clienteId) {
        return fetch(`${window.baseUrl}api/mensagens.php?cliente_id=${clienteId}`)
            .then(res => res.json())
            .then(messages => messages)
            .catch(() => []);
    }

    function openChat(clienteId, nome, telefone, ultimoAtendimentoId, ultimoStatus, setorNome, ultimoProtocolo) {
        currentClienteId = clienteId;
        currentTelefone = telefone;
        currentProtocolo = ultimoProtocolo;
        currentSetorId = null;
        currentStatus = ultimoStatus;

        document.getElementById('chatArea').style.display = 'flex';
        document.getElementById('emptyChat').style.display = 'none';

        const avatarLetter = nome ? nome.charAt(0).toUpperCase() : '?';
        document.getElementById('chatHeader').innerHTML = `
            <div class="avatar">${avatarLetter}</div>
            <div class="chat-header-info">
                <div class="chat-header-name">${escapeHtml(nome)}</div>
                <div class="conversation-lastmsg">${telefone.replace(/^55/, '').replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')}</div>
                <div class="conversation-lastmsg">Protocolo último atendimento: ${escapeHtml(ultimoProtocolo)}</div>
                <div class="chat-header-status">${escapeHtml(setorNome)}</div>
            </div>
            <div id="chatActions" class="d-flex gap-2">
                <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
            </div>
        `;

        // Carrega todo o histórico de mensagens do cliente
        carregarMensagensPorCliente(clienteId).then(messages => {
            renderizarMensagens(messages);
        });

        // Busca atendimento ativo para este cliente
        buscarAtendimentoAtivo(clienteId).then(atendimentoId => {
            if (atendimentoId) {
                currentAtendimentoId = atendimentoId;
                fetch(`${window.baseUrl}api/atendimentos.php?action=get_dados_atendimento&id=${atendimentoId}`)
                    .then(res => res.json())
                    .then(data => {
                        currentSessionId = data.session_id;
                        currentSetorId = data.setor_id;
                        const isAdmin = (window.atendenteId == 1);
                        const blockedStatus = ['finalizado'];
                        const showActions = !blockedStatus.includes(currentStatus?.toLowerCase());
                        const actionButtons = showActions ? `
                            <button class="btn-sm-custom" onclick="window.transferir()" title="Transferir atendimento">Transferir</button>
                            <button class="btn-sm-custom" style="background:#dc3545;" onclick="window.finalizar()" title="Finalizar atendimento">Finalizar</button>
                        ` : '';
                        document.getElementById('chatActions').innerHTML = actionButtons || '<span class="text-muted">Sem atendimento ativo</span>';
                    })
                    .catch(() => {
                        document.getElementById('chatActions').innerHTML = '<span class="text-danger">Erro ao obter dados do atendimento</span>';
                    });
            } else {
                currentAtendimentoId = null;
                document.getElementById('chatActions').innerHTML = '<span class="text-muted">Este cliente não possui atendimento ativo</span>';
                toast('Este cliente não possui atendimento ativo. Para enviar mensagem, o cliente deve iniciar um novo atendimento.', 'info');
            }
        });

        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.clienteId == clienteId) el.classList.add('active');
        });
    }

    function closeChat() {
        currentClienteId = null;
        currentAtendimentoId = null;
        currentSetorId = null;
        document.getElementById('chatArea').style.display = 'none';
        document.getElementById('emptyChat').style.display = 'flex';
        document.getElementById('messagesContainer').innerHTML = '';
    }

    window.enviarMsg = function () {
        const msg = document.getElementById('msgInput').value;
        if (!msg) return toast('Digite uma mensagem', 'info');
        if (!currentAtendimentoId) return toast('Não há atendimento ativo para este cliente', 'info');
        fetchWithToast(
            window.baseUrl + 'api/mensagens.php',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    atendimento_id: currentAtendimentoId,
                    mensagem: msg,
                    session_id: currentSessionId,
                    telefone: currentTelefone
                })
            },
            'Mensagem enviada',
            'Erro ao enviar'
        ).then(() => {
            document.getElementById('msgInput').value = '';
            if (currentClienteId) {
                carregarMensagensPorCliente(currentClienteId).then(messages => {
                    renderizarMensagens(messages);
                });
            }
        });
    };

    window.transferir = function () {
        if (!currentAtendimentoId) {
            toast('Nenhum atendimento ativo', 'error');
            return;
        }

        const isAdmin = (window.atendenteId == 1);
        const currentSetor = currentSetorId; // setor atual do atendimento

        // Função para buscar atendentes de um setor
        function carregarAtendentesPorSetor(setorId, callback) {
            fetch(`${window.baseUrl}api/atendentes.php?action=listar_por_setor&setor_id=${setorId}`)
                .then(res => res.json())
                .then(lista => callback(lista))
                .catch(err => {
                    console.error(err);
                    toast('Erro ao carregar atendentes', 'error');
                    callback([]);
                });
        }

        // Para admin: primeiro mostra seletor de setores
        if (isAdmin) {
            // Buscar lista de setores ativos
            fetch(`${window.baseUrl}api/setores.php`)
                .then(res => res.json())
                .then(setores => {
                    if (!setores.length) {
                        toast('Nenhum setor disponível', 'info');
                        return;
                    }

                    // Remove modal existente
                    const modalId = 'transferModal';
                    const existingModal = document.getElementById(modalId);
                    if (existingModal) existingModal.remove();

                    let modalHtml = `
                    <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Transferir atendimento</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div id="transferStep1">
                                        <label class="form-label">Selecione o setor de destino:</label>
                                        <select id="setorDestinoSelect" class="form-select">
                                            <option value="">-- Escolha um setor --</option>
                `;
                    setores.forEach(s => {
                        modalHtml += `<option value="${s.id}" ${s.id == currentSetor ? 'selected' : ''}>${escapeHtml(s.nome)}</option>`;
                    });
                    modalHtml += `
                                        </select>
                                    </div>
                                    <div id="transferStep2" style="display:none; margin-top:15px;">
                                        <label class="form-label">Selecione o atendente de destino:</label>
                                        <select id="atendenteDestinoSelect" class="form-select">
                                            <option value="">-- Carregando --</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="button" class="btn btn-primary" id="confirmTransferBtn" disabled>Confirmar Transferência</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                    document.body.insertAdjacentHTML('beforeend', modalHtml);

                    const modalElement = document.getElementById(modalId);
                    const modal = new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: false });
                    modal.show();

                    const setorSelect = document.getElementById('setorDestinoSelect');
                    const atendenteSelect = document.getElementById('atendenteDestinoSelect');
                    const step2Div = document.getElementById('transferStep2');
                    const confirmBtn = document.getElementById('confirmTransferBtn');

                    // Ao mudar o setor, carregar atendentes daquele setor
                    setorSelect.addEventListener('change', function () {
                        const setorId = this.value;
                        if (!setorId) {
                            step2Div.style.display = 'none';
                            confirmBtn.disabled = true;
                            atendenteSelect.innerHTML = '<option value="">-- Selecione um setor primeiro --</option>';
                            return;
                        }
                        // Mostra carregando
                        step2Div.style.display = 'block';
                        atendenteSelect.innerHTML = '<option value="">Carregando atendentes...</option>';
                        confirmBtn.disabled = true;

                        carregarAtendentesPorSetor(setorId, (lista) => {
                            if (lista.length === 0) {
                                atendenteSelect.innerHTML = '<option value="">Nenhum atendente disponível neste setor</option>';
                                confirmBtn.disabled = true;
                            } else {
                                let options = '<option value="">Selecione um atendente</option>';
                                lista.forEach(att => {
                                    options += `<option value="${att.id}">${escapeHtml(att.nome)} (ID ${att.id})</option>`;
                                });
                                atendenteSelect.innerHTML = options;
                                confirmBtn.disabled = false; // habilita após selecionar atendente? Melhor só habilitar quando atendente for escolhido
                            }
                        });
                    });

                    // Somente habilita o botão confirmar quando um atendente for selecionado
                    atendenteSelect.addEventListener('change', function () {
                        confirmBtn.disabled = !this.value;
                    });

                    // Confirmar transferência
                    confirmBtn.addEventListener('click', () => {
                        const setorDestino = setorSelect.value;
                        const novoAtendenteId = atendenteSelect.value;
                        if (!novoAtendenteId) {
                            toast('Selecione um atendente', 'info');
                            return;
                        }
                        modal.hide();

                        // Envia requisição de transferência, incluindo o setor de destino (se diferente do atual)
                        const body = {
                            atendimento_id: currentAtendimentoId,
                            atendente_id: parseInt(novoAtendenteId)
                        };
                        if (setorDestino && setorDestino != currentSetor) {
                            body.setor_id = parseInt(setorDestino);
                        }

                        fetchWithToast(
                            window.baseUrl + 'api/atendimentos.php?action=transferir',
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(body)
                            },
                            'Transferência realizada',
                            'Falha na transferência'
                        ).then(() => location.reload());
                    });

                    modalElement.addEventListener('hidden.bs.modal', function () { this.remove(); });
                })
                .catch(err => toast('Erro ao carregar setores', 'error'));
        } else {
            // Atendente comum: lista apenas atendentes do mesmo setor (comportamento atual)
            if (!currentSetorId) {
                toast('Setor não identificado', 'error');
                return;
            }
            fetch(`${window.baseUrl}api/atendentes.php?action=listar_por_setor&setor_id=${currentSetorId}`)
                .then(res => res.json())
                .then(lista => {
                    if (!lista.length) {
                        toast('Nenhum atendente disponível neste setor', 'info');
                        return;
                    }
                    const modalId = 'transferModal';
                    const existingModal = document.getElementById(modalId);
                    if (existingModal) existingModal.remove();
                    let options = '<option value="">Selecione um atendente</option>';
                    lista.forEach(atendente => {
                        options += `<option value="${atendente.id}">${escapeHtml(atendente.nome)} (ID ${atendente.id})</option>`;
                    });
                    const modalHtml = `
                    <div class="modal fade" id="${modalId}" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">Transferir atendimento</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <p>Selecione o atendente para transferir:</p>
                                    <select id="transferSelect" class="form-select">${options}</select>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                    <button type="button" class="btn btn-primary" id="confirmTransferBtn">Confirmar Transferência</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                    const modalElement = document.getElementById(modalId);
                    const modal = new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: false });
                    modal.show();
                    const transferSelect = document.getElementById('transferSelect');
                    const confirmBtn = document.getElementById('confirmTransferBtn');
                    transferSelect.addEventListener('change', () => { confirmBtn.disabled = !transferSelect.value; });
                    confirmBtn.addEventListener('click', () => {
                        const novoId = transferSelect.value;
                        if (!novoId) {
                            toast('Selecione um atendente', 'info');
                            return;
                        }
                        modal.hide();
                        fetchWithToast(
                            window.baseUrl + 'api/atendimentos.php?action=transferir',
                            {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ atendimento_id: currentAtendimentoId, atendente_id: parseInt(novoId) })
                            },
                            'Transferência realizada',
                            'Falha na transferência'
                        ).then(() => location.reload());
                    });
                    modalElement.addEventListener('hidden.bs.modal', function () { this.remove(); });
                })
                .catch(err => toast('Erro ao carregar lista de atendentes', 'error'));
        }
    };

    window.finalizar = function () {
        console.log(currentAtendimentoId)
        if (!currentAtendimentoId) return;
        const modalId = 'confirmFinalizarModal';
        const existingModal = document.getElementById(modalId);
        if (existingModal) existingModal.remove();

        const modalHtml = `
            <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="finalizarLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="finalizarLabel">Finalizar atendimento</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Tem certeza que deseja <strong>finalizar</strong> este atendimento?</p>
                            <p class="text-muted">Após finalizado, não será possível enviar mais mensagens.</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-danger" id="confirmFinalizarBtn">Sim, finalizar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        const modalElement = document.getElementById(modalId);
        const modal = new bootstrap.Modal(modalElement, { backdrop: 'static', keyboard: false });
        modal.show();

        document.getElementById('confirmFinalizarBtn').addEventListener('click', () => {
            modal.hide();
            fetchWithToast(
                window.baseUrl + 'api/atendimentos.php?action=finalizar',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ atendimento_id: currentAtendimentoId })
                },
                'Atendimento finalizado',
                'Erro ao finalizar'
            ).then(() => location.reload());
        });

        modalElement.addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    };

    // Socket events
    socket.on('novoAtendimento', (data) => {
        carregarAtendimentos();
        toast('Novo atendimento recebido', 'info');
    });

    socket.on('novaMensagem', (data) => {
        carregarAtendimentos();
        if (currentAtendimentoId && data.atendimento_id == currentAtendimentoId && currentClienteId) {
            carregarMensagensPorCliente(currentClienteId).then(messages => {
                renderizarMensagens(messages);
                toast('Nova mensagem do cliente', 'info');
            });
        } else if (data.atendimento_id) {
            highlightConversation(data.atendimento_id);
        }
    });

    function highlightConversation(atendimentoId) {
        const cliente = clientesList.find(c => c.ultimo_atendimento_id == atendimentoId);
        if (cliente) {
            const item = document.querySelector(`.conversation-item[data-cliente-id='${cliente.cliente_id}']`);
            if (item) {
                item.style.fontWeight = 'bold';
                setTimeout(() => item.style.fontWeight = '', 3000);
            }
        }
    }

    // Polling fallback
    setInterval(() => {
        if (document.getElementById('listaAtendimentos')) carregarAtendimentos();
        if (currentClienteId && currentAtendimentoId) {
            carregarMensagensPorCliente(currentClienteId).then(messages => {
                renderizarMensagens(messages);
            });
        }
    }, 5000);

    carregarAtendimentos();
    setInterval(carregarAtendimentos, 10000);

    const msgInput = document.getElementById('msgInput');
    if (msgInput) {
        const newInput = msgInput.cloneNode(true);
        msgInput.parentNode.replaceChild(newInput, msgInput);
        newInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') window.enviarMsg();
        });
    }

    window.carregarAtendimentos = carregarAtendimentos;
};

if (document.getElementById('listaAtendimentos')) {
    window.initChat();
}