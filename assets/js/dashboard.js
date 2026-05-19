// dashboard.js - Versão ajustada (filtros somente na aba Atendimento)

let socket = null;
let atendimentosList = [];
let currentAtendimentoId = null;
let currentSessionId = null;
let currentProtocolo = null;
let currentTelefone = null;
let currentSetorId = null;

// ========== FUNÇÕES GLOBAIS (não dependem dos filtros) ==========
// (Nenhuma função global que acesse filtros permanece aqui)

// ========== FUNÇÃO PRINCIPAL DE INICIALIZAÇÃO DO CHAT ==========
window.initChat = function () {
    // Evita múltiplas inicializações
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

    // ========== CONFIGURAÇÃO DOS FILTROS (AGORA DENTRO DO CHAT) ==========
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

    // Inicializa os filtros (carrega setores e adiciona listeners)
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
                atendimentosList = data;
                renderConversations(data);
                if (currentAtendimentoId && !data.find(a => a.id == currentAtendimentoId)) {
                    closeChat();
                }
            })
            .catch(err => toast('Erro ao carregar atendimentos', 'error'));
    }

    function renderConversations(conversations) {
        const container = document.getElementById('listaAtendimentos');
        if (!container) return;
        if (!conversations.length) {
            container.innerHTML = '<div class="text-muted text-center p-4">Nenhum atendimento ativo</div>';
            return;
        }
        let html = '';
        conversations.forEach(conv => {
            const isActive = (currentAtendimentoId == conv.id);
            const avatarText = conv.cliente_nome ? conv.cliente_nome.charAt(0).toUpperCase() : '?';
            html += `
                <div class="conversation-item ${isActive ? 'active' : ''}" 
                     data-id="${conv.id}" 
                     data-session="${conv.session_id}" 
                     data-telefone="${conv.telefone}" 
                     data-nome="${escapeHtml(conv.cliente_nome)}" 
                     data-setor="${conv.setor_nome}"
                     data-setor-id="${conv.setor_id}"
                     data-protocolo="${conv.protocolo}"
                     title="Selecione o atendimento ${conv.protocolo}">                     
                    <div class="avatar">${avatarText}</div>
                    <div class="conversation-info">            
                        <div class="conversation-name">${escapeHtml(conv.cliente_nome)}</div>                          
                        <div class="conversation-lastmsg">Protocolo: ${escapeHtml(conv.protocolo)}</div>
                        <div class="conversation-lastmsg">
                            ${escapeHtml(conv.setor_nome)} 
                            <span class="badge bg-secondary">${escapeHtml(conv.status)}</span>
                        </div>
                    </div>
                    <div class="conversation-time">${formatTime(conv.data_abertura)}</div>
                </div>
            `;
        });
        container.innerHTML = html;
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const session = el.dataset.session;
                const protocolo = el.dataset.protocolo;
                const telefone = el.dataset.telefone;
                const nome = el.dataset.nome;
                const setor = el.dataset.setor;
                const setorId = el.dataset.setorId;
                const status = el.querySelector('.badge').textContent;
                openChat(id, session, protocolo, telefone, nome, setor, setorId, status);
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

    function openChat(id, sessionId, protocolo, telefone, nome, setor, setorId, status) {
        currentAtendimentoId = id;
        currentSessionId = sessionId;
        currentProtocolo = protocolo;
        currentTelefone = telefone;
        currentSetorId = setorId;

        document.getElementById('chatArea').style.display = 'flex';
        document.getElementById('emptyChat').style.display = 'none';

        const avatarLetter = nome ? nome.charAt(0).toUpperCase() : '?';
        const isAdmin = (window.atendenteId == 1);
        const blockedStatus = ['finalizado', 'transferido'];
        // Atendente comum vê botões apenas se status não estiver bloqueado
        const showActions = !blockedStatus.includes(status?.toLowerCase());

        const actionButtons = showActions ? `
            <div>
                <button class="btn-sm-custom" onclick="window.transferir()" title="Transferir atendimento">Transferir</button>
                <button class="btn-sm-custom" style="background:#dc3545;" onclick="window.finalizar()" title="Finalizar atendimento">Finalizar</button>
            </div>
        ` : '';

        document.getElementById('chatHeader').innerHTML = `
            <div class="avatar">${avatarLetter}</div>
            <div class="chat-header-info">
                <div class="chat-header-name">${escapeHtml(nome)}</div>
                <div class="conversation-lastmsg">${telefone.replace(/^55/, '').replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')}</div>
                <div class="conversation-lastmsg">Protocolo: ${escapeHtml(protocolo)}</div>
                <div class="chat-header-status">${escapeHtml(setor)}</div>
            </div>
            ${actionButtons}
        `;
        carregarMensagens(id);
        document.querySelectorAll('.conversation-item').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.id == id) el.classList.add('active');
        });
    }

    function closeChat() {
        currentAtendimentoId = null;
        currentSetorId = null;
        document.getElementById('chatArea').style.display = 'none';
        document.getElementById('emptyChat').style.display = 'flex';
        document.getElementById('messagesContainer').innerHTML = '';
    }

    function carregarMensagens(atendimentoId) {
        fetch(`${window.baseUrl}api/mensagens.php?atendimento_id=${atendimentoId}`)
            .then(res => res.json())
            .then(messages => {
                const container = document.getElementById('messagesContainer');
                if (!messages.length) {
                    container.innerHTML = '<div class="text-muted text-center">Nenhuma mensagem ainda</div>';
                    return;
                }
                let html = '';
                messages.forEach(msg => {
                    const isSent = msg.remetente_tipo === 'atendente';
                    let nomeHtml = '';
                    if (isSent && msg.atendente_nome) {
                        nomeHtml = `<div class="message-sender">${escapeHtml(msg.atendente_nome)}</div>`;
                    }
                    html += `
                        <div class="message ${isSent ? 'sent' : 'received'}">
                            <div class="message-bubble">
                                ${nomeHtml}
                                ${escapeHtml(msg.mensagem)}
                            </div>
                        </div>
                        <div class="message-time ${isSent ? 'sent' : 'received'}">${formatTime(msg.data_envio)}</div>
                    `;
                });
                container.innerHTML = html;
                container.scrollTop = container.scrollHeight;
            })
            .catch(() => toast('Erro ao carregar mensagens', 'error'));
    }

    window.enviarMsg = function () {
        const msg = document.getElementById('msgInput').value;
        if (!msg) return toast('Digite uma mensagem', 'info');
        if (!currentAtendimentoId) return toast('Nenhum atendimento selecionado', 'info');
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
            carregarMensagens(currentAtendimentoId);
        });
    };

    window.transferir = function () {
        if (!currentAtendimentoId) {
            toast('Nenhum atendimento selecionado', 'error');
            return;
        }
        if (!currentSetorId) {
            toast('Setor não identificado para este atendimento', 'error');
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
                    <div class="modal fade" id="${modalId}" tabindex="-1" aria-labelledby="transferModalLabel" aria-hidden="true">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="transferModalLabel">Transferir atendimento</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body" title="Selecione um atendente">
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
                const modal = new bootstrap.Modal(modalElement, {
                    backdrop: 'static',
                    keyboard: false
                });
                modal.show();

                document.getElementById('confirmTransferBtn').addEventListener('click', () => {
                    const select = document.getElementById('transferSelect');
                    const novoId = parseInt(select.value);
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
                            body: JSON.stringify({ atendimento_id: currentAtendimentoId, atendente_id: novoId })
                        },
                        'Transferência realizada',
                        'Falha na transferência'
                    ).then(() => location.reload());
                });

                modalElement.addEventListener('hidden.bs.modal', function () {
                    this.remove();
                });
            })
            .catch(err => {
                console.error(err);
                toast('Erro ao carregar lista de atendentes', 'error');
            });
    };

    window.finalizar = function () {
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
        const modal = new bootstrap.Modal(modalElement, {
            backdrop: 'static',
            keyboard: false
        });
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

    // Eventos do socket
    socket.on('novoAtendimento', (data) => {
        carregarAtendimentos();
        toast('Novo atendimento recebido', 'info');
    });

    socket.on('novaMensagem', (data) => {
        carregarAtendimentos();
        if (currentAtendimentoId && data.atendimento_id == currentAtendimentoId) {
            carregarMensagens(currentAtendimentoId);
            toast('Nova mensagem do cliente', 'info');
        } else {
            highlightConversation(data.atendimento_id);
        }
    });

    function highlightConversation(atendimentoId) {
        const item = document.querySelector(`.conversation-item[data-id='${atendimentoId}']`);
        if (item) {
            item.style.fontWeight = 'bold';
            setTimeout(() => item.style.fontWeight = '', 3000);
        }
    }

    // Polling de fallback
    setInterval(() => {
        if (document.getElementById('listaAtendimentos')) carregarAtendimentos();
        if (currentAtendimentoId) carregarMensagens(currentAtendimentoId);
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

// Carregamento direto (atendimento.php)
if (document.getElementById('listaAtendimentos')) {
    window.initChat();
}