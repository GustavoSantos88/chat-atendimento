// admin_manage.js - com persistência de sub-aba (Atendentes/Setores)

// Salva a sub-aba ativa no localStorage
function saveManageTab(activeTabId) {
    localStorage.setItem('manageActiveTab', activeTabId);
}

// Restaura a sub-aba ativa usando Bootstrap Tab API
function restoreManageTab() {
    const savedTab = localStorage.getItem('manageActiveTab');
    const atendentesTab = document.getElementById('atendentes-tab');
    const setoresTab = document.getElementById('setores-tab');
    if (savedTab === 'setores-tab' && setoresTab) {
        // Remove active da aba atendentes e do painel correspondente
        if (atendentesTab) atendentesTab.classList.remove('active');
        const painelAtendentes = document.getElementById('atendentes');
        if (painelAtendentes) painelAtendentes.classList.remove('show', 'active');
        // Ativa setores
        setoresTab.classList.add('active');
        const painelSetores = document.getElementById('setores');
        if (painelSetores) painelSetores.classList.add('show', 'active');
    } else {
        // Garante que atendentes esteja ativo (padrão)
        if (atendentesTab) atendentesTab.classList.add('active');
        if (setoresTab) setoresTab.classList.remove('active');
        const painelAtendentes = document.getElementById('atendentes');
        if (painelAtendentes) painelAtendentes.classList.add('show', 'active');
        const painelSetores = document.getElementById('setores');
        if (painelSetores) painelSetores.classList.remove('show', 'active');
    }
}

window.initManage = function () {
    // console.log('initManage chamado');
    // Aguarda o DOM ser atualizado (o conteúdo foi injetado via innerHTML)
    setTimeout(() => {
        const btnNovoAtendente = document.getElementById('novoAtendenteBtn');
        const tbodyAtendentes = document.getElementById('atendentesTableBody');
        if (btnNovoAtendente && tbodyAtendentes) {
            // Carrega dados
            carregarAtendentes();
            carregarSetores();

            // Eventos dos botões
            btnNovoAtendente.onclick = () => abrirModalAtendente();
            const btnNovoSetor = document.getElementById('novoSetorBtn');
            if (btnNovoSetor) btnNovoSetor.onclick = () => abrirModalSetor();

            // Listeners para salvar a sub-aba quando o usuário trocar
            const atendentesTab = document.getElementById('atendentes-tab');
            const setoresTab = document.getElementById('setores-tab');
            if (atendentesTab && setoresTab) {
                atendentesTab.addEventListener('click', () => {
                    saveManageTab('atendentes-tab');
                });
                setoresTab.addEventListener('click', () => {
                    saveManageTab('setores-tab');
                });
                // Opcional: recarregar dados ao trocar de aba (caso queira)
                atendentesTab.addEventListener('shown.bs.tab', () => carregarAtendentes());
                setoresTab.addEventListener('shown.bs.tab', () => carregarSetores());
            }

            // Restaura a sub-aba salva (executa após a definição dos eventos)
            restoreManageTab();
        } else {
            console.error('Elementos não encontrados. Aguardando...');
            setTimeout(window.initManage, 300);
        }
    }, 100);
};

function carregarAtendentes() {
    const tbody = document.getElementById('atendentesTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Carregando...</td></tr>';
    fetch(window.baseUrl + 'api/atendentes_admin.php')
        .then(res => res.json())
        .then(data => {
            if (!data.length) {
                tbody.innerHTML = '<td><td colspan="7" class="text-center">Nenhum atendente cadastrado</td></tr>';
                return;
            }
            let html = '';
            data.forEach(a => {
                const statusBadge = `<span class="badge bg-${a.status === 'online' ? 'success' : (a.status === 'offline' ? 'secondary' : 'warning')}">${a.status}</span>`;
                const ativoIcon = a.ativo ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>';
                const isAdminBadge = a.isAdmin ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-x-circle-fill text-danger"></i>';
                html += `<tr>
                    <td>${a.id}</td>
                    <td>${escapeHtml(a.nome)}</td>
                    <td>${escapeHtml(a.email)}</td>
                    <td>${escapeHtml(a.telefone)}</td>
                    <td>${statusBadge}</td>
                    <td>${isAdminBadge}</td>
                    <td>${ativoIcon}</td>                    
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editarAtendente(${a.id})">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="toggleAtendenteExcluir(${a.id})">Excluir</button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = '<td><td colspan="7" class="text-center text-danger">Erro ao carregar</td></tr>';
        });
}

function carregarSetores() {
    const tbody = document.getElementById('setoresTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<td><td colspan="4" class="text-center">Carregando...</td></tr>';
    fetch(window.baseUrl + 'api/setores_admin.php')
        .then(res => res.json())
        .then(data => {
            if (!data.length) {
                tbody.innerHTML = '<td><td colspan="4" class="text-center">Nenhum setor cadastrado</td></tr>';
                return;
            }
            let html = '';
            data.forEach(s => {
                html += `<tr>
                    <td>${s.id}</td>
                    <td>${escapeHtml(s.nome)}</td>
                    <td><span class="badge bg-${s.status === 'ativo' ? 'success' : 'danger'}">${s.status}</span></td>                    
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="editarSetor(${s.id})">Editar</button>
                        <button class="btn btn-sm btn-danger" onclick="toggleSetorExcluir(${s.id})">Excluir</button>
                    </td>
                </tr>`;
            });
            tbody.innerHTML = html;
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = '<td><td colspan="4" class="text-center text-danger">Erro ao carregar</td></tr>';
        });
}

// CRUD Atendentes
function abrirModalAtendente(id = null) {
    let titulo = id ? 'Editar Atendente' : 'Novo Atendente';
    let html = `
        <div class="modal fade" id="modalAtendente" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${titulo}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="atendenteId" value="${id || ''}">
                        <div class="mb-2"><label>Nome</label><input type="text" id="atendenteNome" class="form-control" required></div>
                        <div class="mb-2"><label>Email</label><input type="email" id="atendenteEmail" class="form-control" required></div>
                        <div class="mb-2"><label>Telefone</label><input type="text" id="atendenteTelefone" class="form-control"></div>
                        <div class="mb-2"><label>Status</label>
                            <select id="atendenteStatus" class="form-select">
                                <option value="online">Online</option>
                                <option value="offline">Offline</option>
                                <option value="pausa">Pausa</option>
                            </select>
                        </div>
                         <div class="mb-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="atendenteAdmin" value="1">
                                <label class="form-check-label" for="atendenteAdmin">Administrador</label>
                            </div>
                        </div>
                        <div class="mb-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="atendenteAtivo" value="1">
                                <label class="form-check-label" for="atendenteAtivo">Ativo</label>
                            </div>
                        </div>                       
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="salvarAtendenteBtn">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const existingModal = document.getElementById('modalAtendente');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', html);

    if (id) {
        fetch(window.baseUrl + 'api/atendentes_admin.php')
            .then(res => res.json())
            .then(lista => {
                const att = lista.find(a => a.id == id);
                if (att) {
                    document.getElementById('atendenteNome').value = att.nome || '';
                    document.getElementById('atendenteEmail').value = att.email || '';
                    document.getElementById('atendenteTelefone').value = att.telefone || '';
                    document.getElementById('atendenteStatus').value = att.status || 'offline';
                    document.getElementById('atendenteAtivo').checked = att.ativo == 1;
                    document.getElementById('atendenteAdmin').checked = att.isAdmin == 1;
                }
            });
    }

    const modal = new bootstrap.Modal(document.getElementById('modalAtendente'));
    modal.show();

    document.getElementById('salvarAtendenteBtn').onclick = () => {
        const nome = document.getElementById('atendenteNome').value.trim().toUpperCase(); // Força nome em maiúsculas
        const email = document.getElementById('atendenteEmail').value;
        const telefone = document.getElementById('atendenteTelefone').value;
        const status = document.getElementById('atendenteStatus').value;
        const ativo = document.getElementById('atendenteAtivo').checked ? 1 : 0;
        const isAdmin = document.getElementById('atendenteAdmin').checked ? 1 : 0;
        if (!nome || !email) return toast('Nome e email são obrigatórios', 'error');
        const url = window.baseUrl + 'api/atendentes_admin.php';
        const method = id ? 'PUT' : 'POST';
        const body = id ? { id, nome, email, telefone, status, ativo, isAdmin } : { nome, email, telefone, status, ativo, isAdmin };
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(() => {
            modal.hide();
            carregarAtendentes();
            toast(id ? 'Atendente atualizado' : 'Atendente criado', 'success');
        }).catch(() => toast('Erro ao salvar', 'error'));
    };
    document.getElementById('modalAtendente').addEventListener('hidden.bs.modal', () => document.getElementById('modalAtendente')?.remove());
}

window.editarAtendente = (id) => abrirModalAtendente(id);
window.toggleAtendenteExcluir = (id) => {
    if (!confirm('Excluir este atendente permanentemente?')) return;
    fetch(window.baseUrl + 'api/atendentes_admin.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }).then(() => {
        carregarAtendentes();
        toast('Atendente excluído', 'success');
    }).catch(() => toast('Erro ao excluir', 'error'));
};

// CRUD Setores
function abrirModalSetor(id = null) {
    let html = `
        <div class="modal fade" id="modalSetor" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${id ? 'Editar Setor' : 'Novo Setor'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="setorId" value="${id || ''}">
                        <div class="mb-2"><label>Nome do Setor</label><input type="text" id="setorNome" class="form-control" required></div>
                        <div class="mb-2"><label>Status</label>
                            <select id="setorStatus" class="form-select">
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button class="btn btn-primary" id="salvarSetorBtn">Salvar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    const existingModal = document.getElementById('modalSetor');
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    if (id) {
        fetch(window.baseUrl + 'api/setores_admin.php')
            .then(res => res.json())
            .then(lista => {
                const setor = lista.find(s => s.id == id);
                if (setor) {
                    document.getElementById('setorNome').value = setor.nome;
                    document.getElementById('setorStatus').value = setor.status;
                }
            });
    }
    const modal = new bootstrap.Modal(document.getElementById('modalSetor'));
    modal.show();

    document.getElementById('salvarSetorBtn').onclick = () => {
        const nome = document.getElementById('setorNome').value;
        const status = document.getElementById('setorStatus').value;
        if (!nome) return toast('Nome é obrigatório', 'error');
        const url = window.baseUrl + 'api/setores_admin.php';
        const method = id ? 'PUT' : 'POST';
        const body = id ? { id, nome, status } : { nome, status };
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(() => {
            modal.hide();
            carregarSetores();
            toast(id ? 'Setor atualizado' : 'Setor criado', 'success');
        }).catch(() => toast('Erro', 'error'));
    };
    document.getElementById('modalSetor').addEventListener('hidden.bs.modal', () => document.getElementById('modalSetor')?.remove());
}

window.editarSetor = (id) => abrirModalSetor(id);
window.toggleSetorExcluir = (id) => {
    if (!confirm('Excluir este setor permanentemente?')) return;
    fetch(window.baseUrl + 'api/setores_admin.php', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    }).then(() => {
        carregarSetores();
        toast('Setor excluído', 'success');
    }).catch(() => toast('Erro ao excluir', 'error'));
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}