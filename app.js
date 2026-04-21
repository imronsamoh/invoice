import { supabase } from './supabaseClient.js';

// ==========================================
// 1. ระบบ UI (Alerts, Modals, Tabs, Navigation)
// ==========================================
let alertIdCounter = 0;
window.showAlert = (type, title, msg) => {
    const icons = { success: 'fa-circle-check', warn: 'fa-triangle-exclamation', danger: 'fa-circle-xmark', info: 'fa-circle-info' };
    const id = 'toast_' + (++alertIdCounter);
    const container = document.getElementById('alertsContainer');
    const el = document.createElement('div');
    el.className = `alert-toast alert-${type}`;
    el.id = id;
    el.innerHTML = `
        <div class="alert-icon"><i class="fa-solid ${icons[type]}"></i></div>
        <div style="flex:1"><div class="alert-title">${title}</div><div class="alert-msg">${msg}</div></div>
        <div class="alert-bar" style="width:100%"></div>
    `;
    container.appendChild(el);
    setTimeout(() => { if(document.getElementById(id)) document.getElementById(id).remove() }, 3500);
};

// Modals
window.openModal = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');

// Close modal on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(m => {
    m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('open'); });
});

// Navigation
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        navItems.forEach(n => n.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        const target = item.getAttribute('data-page');
        document.getElementById(`page-${target}`).classList.add('active');
        document.getElementById('breadcrumb').textContent = item.textContent.trim();
        document.getElementById('sidebar').classList.remove('open');
        if (target === 'docs' || target === 'dashboard') window.loadDocuments();
    });
});
document.getElementById('menu-toggle').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('open'); });

// ==========================================
// 2. ระบบ Login & Auth
// ==========================================
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        document.getElementById('login-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'flex';
        document.getElementById('user-email-display').textContent = session.user.email;
        loadCompanySettings();
        window.loadDocuments();
    } else {
        document.getElementById('login-section').style.display = 'flex';
        document.getElementById('app-section').style.display = 'none';
    }
}
checkAuth();

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.textContent = 'กำลังตรวจสอบ...'; btn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
    });
    if (error) {
        window.showAlert('danger', 'เกิดข้อผิดพลาด', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        btn.textContent = 'เข้าสู่ระบบ'; btn.disabled = false;
    } else {
        window.showAlert('success', 'สำเร็จ', 'เข้าสู่ระบบเรียบร้อย');
        checkAuth();
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => { await supabase.auth.signOut(); checkAuth(); });

// ==========================================
// 3. ระบบจัดการเอกสาร (ดึงข้อมูล, แท็บตัวกรอง, ลบ, เปลี่ยนสถานะ)
// ==========================================
const formatTHB = (num) => `฿${parseFloat(num || 0).toLocaleString('th-TH', {minimumFractionDigits:2})}`;
let currentFilter = 'all';

// Tabs
window.filterTab = (el, status) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    currentFilter = status;
    window.loadDocuments();
};

window.loadDocuments = async () => {
    const tbody = document.getElementById('doc-list-body');
    
    // ดึงข้อมูลและกรองตาม Tab
    let query = supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (currentFilter !== 'all') query = query.eq('status', currentFilter);

    const { data, error } = await query;
    
    if (error) return window.showAlert('danger', 'Error', error.message);
    if (!data || data.length === 0) return tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">ไม่มีข้อมูลเอกสาร</td></tr>';

    tbody.innerHTML = '';
    let pendingCount = 0, paidSum = 0;

    data.forEach(doc => {
        if (doc.status === 'pending') pendingCount++;
        if (doc.status === 'paid') paidSum += parseFloat(doc.net_amount);

        let badge = '';
        if(doc.status === 'draft') badge = '<span class="badge badge-draft">ร่าง</span>';
        else if(doc.status === 'pending') badge = '<span class="badge badge-pending">รออนุมัติ</span>';
        else if(doc.status === 'approved') badge = '<span class="badge badge-approved">อนุมัติแล้ว</span>';
        else if(doc.status === 'paid') badge = '<span class="badge badge-paid">ชำระแล้ว</span>';

        let typeLabel = doc.doc_type === 'pv' ? 'PV' : (doc.doc_type === 'receipt_certificate' ? 'RC' : 'PR');

        tbody.innerHTML += `
            <tr>
                <td style="font-weight:600; color:var(--text-3);">${typeLabel}</td>
                <td style="font-weight:600; color:var(--accent);">${doc.doc_no}</td>
                <td>${doc.doc_date}</td>
                <td>${doc.vendor_name}</td>
                <td style="text-align:right; font-weight:600;">${formatTHB(doc.net_amount)}</td>
                <td style="text-align:center;">${badge}</td>
                <td style="text-align:center;">
                    <div style="display:flex; justify-content:center; gap:4px">
                        <button class="btn btn-secondary btn-sm btn-icon" title="พิมพ์" onclick="printDoc('${doc.id}')"><i class="fa-solid fa-print"></i></button>
                        <button class="btn btn-secondary btn-sm btn-icon" title="เปลี่ยนสถานะ" onclick="window.confirmStatus('${doc.id}', '${doc.doc_no}', '${doc.status}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="btn btn-secondary btn-sm btn-icon" title="ลบ" onclick="window.confirmDelete('${doc.id}', '${doc.doc_no}')"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });

    document.getElementById('stat-total').textContent = data.length;
    document.getElementById('stat-pending').textContent = pendingCount;
    document.getElementById('stat-paid').textContent = formatTHB(paidSum);
    
    if (pendingCount > 0) {
        document.getElementById('dashboard-alert').innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--warn)"></i><div class="ia-text">มี <strong>${pendingCount} รายการ</strong> ที่รออนุมัติ กรุณาตรวจสอบ</div>`;
    } else {
        document.getElementById('dashboard-alert').innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--success)"></i><div class="ia-text">ไม่มีเอกสารค้างอนุมัติ</div>`;
    }
};

// ลบเอกสาร
let docIdToDelete = null;
window.confirmDelete = (id, docNo) => {
    docIdToDelete = id;
    document.getElementById('confirmHeading').textContent = `ลบเอกสาร ${docNo} ?`;
    window.openModal('confirmModal');
};
document.getElementById('confirmActionBtn').addEventListener('click', async () => {
    if (!docIdToDelete) return;
    const { error } = await supabase.from('documents').delete().eq('id', docIdToDelete);
    window.closeModal('confirmModal');
    if (error) window.showAlert('danger', 'ลบไม่สำเร็จ', error.message);
    else {
        window.showAlert('success', 'ลบเอกสารแล้ว', 'นำออกจากระบบเรียบร้อย');
        window.loadDocuments();
    }
});

// เปลี่ยนสถานะเอกสาร
let docIdToStatus = null;
window.confirmStatus = (id, docNo, currentStatus) => {
    docIdToStatus = id;
    document.getElementById('statusDocRef').textContent = docNo;
    const radio = document.querySelector(`input[name="docStatus"][value="${currentStatus}"]`);
    if(radio) radio.checked = true;
    window.openModal('statusModal');
};
document.getElementById('saveStatusBtn').addEventListener('click', async () => {
    if (!docIdToStatus) return;
    const newStatus = document.querySelector('input[name="docStatus"]:checked').value;
    const { error } = await supabase.from('documents').update({ status: newStatus }).eq('id', docIdToStatus);
    window.closeModal('statusModal');
    if (error) window.showAlert('danger', 'ข้อผิดพลาด', error.message);
    else {
        window.showAlert('success', 'อัปเดตสถานะแล้ว', 'บันทึกสถานะใหม่เรียบร้อย');
        window.loadDocuments();
    }
});

// ==========================================
// 4. ระบบ Vendor Modal (เพิ่มผู้รับเงิน)
// ==========================================
document.getElementById('saveVendorBtn').addEventListener('click', async () => {
    const name = document.getElementById('vm_name').value;
    const taxid = document.getElementById('vm_taxid').value;
    const phone = document.getElementById('vm_phone').value;
    const addr = document.getElementById('vm_addr').value;
    
    if(!name) return window.showAlert('warn', 'ข้อมูลไม่ครบ', 'กรุณาระบุชื่อผู้รับเงิน');
    
    // บันทึกลงตาราง vendors
    const { error } = await supabase.from('vendors').insert([{ name: name, tax_id: taxid, phone: phone, address: addr }]);
    
    window.closeModal('formModal');
    if(error) window.showAlert('danger', 'เกิดข้อผิดพลาด', error.message);
    else {
        window.showAlert('success', 'สำเร็จ', 'เพิ่มคู่ค้าเข้าระบบแล้ว');
        // Auto fill in PV form
        document.getElementById('pv-vendor').value = name;
    }
});

// ==========================================
// 5. ระบบ PV (Dynamic Table & Drag/Drop)
// ==========================================
let pvItems = [];
window.addPvRow = () => { pvItems.push({ id: Date.now(), desc: '', qty: 1, price: 0, disc: 0, is_vat: false, is_wht: true }); window.renderPvTable(); };
window.updatePvItem = (idx, field, el) => {
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if (['qty', 'price', 'disc'].includes(field)) val = parseFloat(val) || 0;
    pvItems[idx][field] = val; window.renderPvTable();
};
window.removePvRow = (idx) => { pvItems.splice(idx, 1); window.renderPvTable(); };

window.renderPvTable = () => {
    const tbody = document.getElementById('pv-items-body');
    tbody.innerHTML = '';
    let totalBase = 0, totalVatBase = 0, totalWhtBase = 0;

    pvItems.forEach((item, i) => {
        const lineTotal = (item.qty * item.price) - item.disc;
        totalBase += lineTotal;
        if(item.is_vat) totalVatBase += lineTotal;
        if(item.is_wht) totalWhtBase += lineTotal;

        tbody.innerHTML += `
            <tr>
                <td><input type="text" value="${item.desc}" onchange="updatePvItem(${i}, 'desc', this)"></td>
                <td><input type="number" value="${item.qty}" style="text-align:center;" onchange="updatePvItem(${i}, 'qty', this)"></td>
                <td><input type="number" value="${item.price}" style="text-align:right;" onchange="updatePvItem(${i}, 'price', this)"></td>
                <td><input type="number" value="${item.disc}" style="text-align:right;" onchange="updatePvItem(${i}, 'disc', this)"></td>
                <td style="text-align:center;"><input type="checkbox" ${item.is_vat ? 'checked':''} onchange="updatePvItem(${i}, 'is_vat', this)"></td>
                <td style="text-align:center;"><input type="checkbox" ${item.is_wht ? 'checked':''} onchange="updatePvItem(${i}, 'is_wht', this)"></td>
                <td style="text-align:right; font-weight:600;">${formatTHB(lineTotal)}</td>
                <td><button type="button" class="del-btn" onclick="removePvRow(${i})"><i class="fa-solid fa-xmark"></i></button></td>
            </tr>
        `;
    });

    const vatAmt = totalVatBase * 0.07;
    const whtRate = parseFloat(document.getElementById('pv-wht-rate').value) || 0;
    const whtAmt = totalWhtBase * (whtRate / 100);
    
    document.getElementById('pv-sum-base').textContent = formatTHB(totalBase);
    document.getElementById('pv-sum-vat').textContent = formatTHB(vatAmt);
    document.getElementById('pv-sum-wht').textContent = '-' + formatTHB(whtAmt);
    document.getElementById('pv-sum-net').textContent = formatTHB(totalBase + vatAmt - whtAmt);
};
window.addPvRow(); 

// Drag & Drop Zone
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('pv-file');
const thumbGrid = document.getElementById('thumbGrid');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = 'var(--accent-surface)'; });
dropZone.addEventListener('dragleave', () => { dropZone.style.background = ''; });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.style.background = '';
    if(e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFileSelect(fileInput.files);
    }
});
fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files));

function handleFileSelect(files) {
    thumbGrid.innerHTML = '';
    if(files.length > 0) {
        window.showAlert('info', 'แนบไฟล์', `เลือกไฟล์ ${files[0].name} แล้ว`);
        const reader = new FileReader();
        reader.onload = (e) => {
            if(files[0].type.startsWith('image/')) thumbGrid.innerHTML = `<img src="${e.target.result}" style="width:80px; height:80px; object-fit:cover; border-radius:var(--r); border:1px solid var(--border)">`;
            else thumbGrid.innerHTML = `<div style="width:80px; height:80px; background:var(--surface-2); display:flex; align-items:center; justify-content:center; border-radius:var(--r); color:var(--danger); font-weight:bold;">PDF</div>`;
        };
        reader.readAsDataURL(files[0]);
    }
}

// Save PV
document.getElementById('pv-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if(pvItems.length === 0) return window.showAlert('warn', 'ข้อมูลไม่ครบ', 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการ');
    const { data: { user } } = await supabase.auth.getUser();
    
    const btn = document.getElementById('pv-submit-btn');
    btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;

    try {
        const parseCurrency = (id) => parseFloat(document.getElementById(id).textContent.replace(/[^0-9.-]+/g,"")) || 0;
        
        const docPayload = {
            doc_no: `PV${Date.now().toString().slice(-6)}`, doc_type: 'pv',
            doc_date: document.getElementById('pv-date').value, vendor_name: document.getElementById('pv-vendor').value,
            status: document.getElementById('pv-status').value, remarks: document.getElementById('pv-remarks').value,
            total_amount_before_vat: parseCurrency('pv-sum-base'), vat_amount: parseCurrency('pv-sum-vat'),
            wht_percent: parseFloat(document.getElementById('pv-wht-rate').value), wht_amount: Math.abs(parseCurrency('pv-sum-wht')),
            net_amount: parseCurrency('pv-sum-net'), created_by: user.id
        };
        const { data: doc, error: docErr } = await supabase.from('documents').insert([docPayload]).select('id').single();
        if(docErr) throw docErr;

        const itemsPayload = pvItems.map(item => ({
            document_id: doc.id, description: item.desc, qty: item.qty, unit_price: item.price,
            item_discount: item.disc, is_vat: item.is_vat, is_wht: item.is_wht
        }));
        await supabase.from('document_items').insert(itemsPayload);

        const file = fileInput.files[0];
        if (file) {
            const path = `pv_attachments/${doc.id}/${file.name}`;
            await supabase.storage.from('document_files').upload(path, file);
            const { data: urlData } = supabase.storage.from('document_files').getPublicUrl(path);
            await supabase.from('attachments').insert([{ document_id: doc.id, file_url: urlData.publicUrl }]);
        }

        window.showAlert('success', 'สำเร็จ', 'บันทึกใบสำคัญจ่ายเรียบร้อย');
        document.getElementById('pv-form').reset();
        thumbGrid.innerHTML = '';
        pvItems = []; window.addPvRow();
        document.querySelector('[data-page="docs"]').click();
    } catch(err) { window.showAlert('danger', 'Error', err.message); }
    finally { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกใบสำคัญจ่าย'; btn.disabled = false; }
});

// ==========================================
// 6. บันทึก RC และ PR
// ==========================================
const saveSimpleDoc = async (type, formId, payloadFn) => {
    document.getElementById(formId).addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        const btn = document.querySelector(`#${formId} button[type="submit"]`);
        btn.disabled = true;
        
        try {
            const { docPayload, itemPayload } = payloadFn(user.id);
            const { data: doc, error: docErr } = await supabase.from('documents').insert([docPayload]).select('id').single();
            if(docErr) throw docErr;
            
            itemPayload.document_id = doc.id;
            await supabase.from('document_items').insert([itemPayload]);

            window.showAlert('success', 'สำเร็จ', 'บันทึกเอกสารเรียบร้อย');
            document.getElementById(formId).reset();
            document.querySelector('[data-page="docs"]').click();
        } catch(err) { window.showAlert('danger', 'Error', err.message); }
        finally { btn.disabled = false; }
    });
};

saveSimpleDoc('rc', 'rc-form', (uid) => {
    const amt = parseFloat(document.getElementById('rc-amount').value);
    return {
        docPayload: {
            doc_no: `RC${Date.now().toString().slice(-6)}`, doc_type: 'receipt_certificate', doc_date: document.getElementById('rc-date').value,
            vendor_name: document.getElementById('rc-name').value, status: 'paid',
            remarks: `บัตร: ${document.getElementById('rc-citizen').value} | ที่อยู่: ${document.getElementById('rc-address').value}`,
            total_amount_before_vat: amt, net_amount: amt, created_by: uid
        },
        itemPayload: { description: document.getElementById('rc-desc').value, qty: 1, unit_price: amt }
    };
});

saveSimpleDoc('pr', 'pr-form', (uid) => {
    const amt = parseFloat(document.getElementById('pr-amount').value);
    return {
        docPayload: {
            doc_no: `PR${Date.now().toString().slice(-6)}`, doc_type: 'payment_requisition', doc_date: document.getElementById('pr-date').value,
            due_date: document.getElementById('pr-due').value, vendor_name: document.getElementById('pr-name').value, status: 'pending',
            remarks: `แผนก: ${document.getElementById('pr-dept').value} | วัตถุประสงค์: ${document.getElementById('pr-desc').value}`,
            total_amount_before_vat: amt, net_amount: amt, created_by: uid
        },
        itemPayload: { description: document.getElementById('pr-desc').value, qty: 1, unit_price: amt }
    };
});

// ==========================================
// 7. ตั้งค่าบริษัท
// ==========================================
async function loadCompanySettings() {
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    if (data) {
        document.getElementById('sidebar-company-name').textContent = data.company_name || '';
        document.getElementById('comp-name').value = data.company_name || '';
        document.getElementById('comp-tax').value = data.tax_id || '';
        document.getElementById('comp-phone').value = data.phone || '';
        document.getElementById('comp-address').value = data.address || '';
        if(data.logo_url) {
            document.getElementById('comp-logo-preview').src = data.logo_url;
            document.getElementById('comp-logo-preview').style.display = 'block';
            document.getElementById('comp-logo-preview').setAttribute('data-url', data.logo_url);
        }
    }
}

document.getElementById('company-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('comp-submit-btn');
    btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;
    try {
        let finalUrl = document.getElementById('comp-logo-preview').getAttribute('data-url') || '';
        const file = document.getElementById('comp-logo-file').files[0];
        if (file) {
            const path = `logos/${Date.now()}_${file.name}`;
            await supabase.storage.from('company_assets').upload(path, file);
            finalUrl = supabase.storage.from('company_assets').getPublicUrl(path).data.publicUrl;
        }

        await supabase.from('company_settings').upsert({
            id: 1, company_name: document.getElementById('comp-name').value, tax_id: document.getElementById('comp-tax').value,
            address: document.getElementById('comp-address').value, phone: document.getElementById('comp-phone').value, logo_url: finalUrl
        });
        window.showAlert('success', 'สำเร็จ', 'อัปเดตข้อมูลบริษัทเรียบร้อย');
        loadCompanySettings();
    } catch(err) { window.showAlert('danger', 'Error', err.message); }
    finally { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล'; btn.disabled = false; }
});

// ==========================================
// 8. พิมพ์ PDF
// ==========================================
window.printDoc = async (id) => {
    try {
        const { data: doc } = await supabase.from('documents').select('*').eq('id', id).single();
        const { data: items } = await supabase.from('document_items').select('*').eq('document_id', id);
        const { data: comp } = await supabase.from('company_settings').select('*').eq('id', 1).single();

        if(comp) {
            document.getElementById('print-comp-name').textContent = comp.company_name;
            document.getElementById('print-comp-address').textContent = comp.address;
            document.getElementById('print-comp-tax').textContent = comp.tax_id;
            document.getElementById('print-comp-phone').textContent = comp.phone;
            if(comp.logo_url) {
                document.getElementById('print-logo').src = comp.logo_url;
                document.getElementById('print-logo').style.display = 'block';
            }
        }

        let docTitle = doc.doc_type === 'pv' ? 'ใบสำคัญจ่าย' : (doc.doc_type === 'receipt_certificate' ? 'หนังสือรับรองแทนใบเสร็จ' : 'ใบเบิกจ่าย');
        let docSub = doc.doc_type === 'pv' ? '(Payment Voucher)' : (doc.doc_type === 'receipt_certificate' ? '(Receipt Certificate)' : '(Payment Requisition)');

        document.getElementById('print-doc-title').textContent = docTitle;
        document.getElementById('print-doc-subtitle').textContent = docSub;
        document.getElementById('print-doc-no').textContent = doc.doc_no;
        document.getElementById('print-doc-date').textContent = doc.doc_date;
        document.getElementById('print-vendor').textContent = doc.vendor_name;
        document.getElementById('print-remarks').textContent = doc.remarks || '-';

        const tbody = document.getElementById('print-items-body');
        tbody.innerHTML = '';
        items.forEach(item => {
            const lineTot = (item.qty * item.unit_price) - item.item_discount;
            tbody.innerHTML += `<tr>
                <td style="border:1px solid #000; padding:8px;">${item.description}</td>
                <td style="border:1px solid #000; padding:8px; text-align:center;">${item.qty}</td>
                <td style="border:1px solid #000; padding:8px; text-align:right;">${formatTHB(item.unit_price)}</td>
                <td style="border:1px solid #000; padding:8px; text-align:right;">${formatTHB(lineTot)}</td>
            </tr>`;
        });

        document.getElementById('print-base').textContent = formatTHB(doc.total_amount_before_vat);
        document.getElementById('print-vat').textContent = formatTHB(doc.vat_amount);
        document.getElementById('print-wht').textContent = '-' + formatTHB(doc.wht_amount);
        document.getElementById('print-net').textContent = formatTHB(doc.net_amount);

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-print').classList.add('active');
    } catch(err) { window.showAlert('danger', 'Error', err.message); }
};

// ==========================================
// 9. ระบบค้นหาเอกสาร (Search Filter)
// ==========================================
document.getElementById('search-doc-input').addEventListener('keyup', function(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#doc-list-body tr');
    
    rows.forEach(row => {
        // ค้นหาจากข้อความทั้งหมดในแถวนั้น (เลขที่, ชื่อผู้รับเงิน, ยอดเงิน)
        const text = row.textContent.toLowerCase();
        if (text.includes(term)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
});
