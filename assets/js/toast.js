function toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.textContent = message;
    el.style.position = 'relative';
    el.style.margin = '10px';
    el.style.padding = '12px 20px';
    el.style.borderRadius = '8px';
    el.style.backgroundColor = type === 'error' ? '#dc3545' : type === 'success' ? '#198754' : type === 'warning' ? '#ffc107' : '#0d6efd';
    el.style.color = 'white';
    el.style.fontSize = '14px';
    el.style.fontWeight = '500';
    el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    container.appendChild(el);
    setTimeout(() => el.remove(), 4200);
}
