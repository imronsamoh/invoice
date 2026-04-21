import { supabase } from './supabaseClient.js';

// ==========================================
// ส่วนที่ 1: การจัดการ Auth และเข้าสู่ระบบ
// ==========================================
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showApp(session.user);
    } else {
        showLogin();
    }
}

function showApp(user) {
    loginSection.style.display = 'none';
    appSection.style.display = 'flex';
    document.getElementById('user-email').textContent = user.email;
}

function showLogin() {
    loginSection.style.display = 'flex';
    appSection.style.display = 'none';
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    const errorMsg = document.getElementById('login-error');
    
    loginBtn.textContent = 'กำลังตรวจสอบ...';
    loginBtn.disabled = true;
    errorMsg.style.display = 'none';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        errorMsg.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        errorMsg.style.display = 'block';
        loginBtn.textContent = 'เข้าสู่ระบบ';
        loginBtn.disabled = false;
    } else {
        loginForm.reset();
        loginBtn.textContent = 'เข้าสู่ระบบ';
        loginBtn.disabled = false;
        showApp(data.user);
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showLogin();
});

// ==========================================
// ส่วนที่ 2: ระบบจัดการเมนู (Navigation)
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const pageViews = document.querySelectorAll('.page-view');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');

menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        const targetPage = item.getAttribute('data-page');
        pageViews.forEach(page => page.style.display = 'none');
        document.getElementById(`view-${targetPage}`).style.display = 'block';
        sidebar.classList.remove('open');
    });
});

// ==========================================
// ส่วนที่ 3: ระบบตาราง Dynamic (ฟอร์ม PV)
// ==========================================
let documentItems = [];

// เปิดเผยฟังก์ชันให้ HTML เรียกใช้งานผ่าน onclick ได้ (แก้ Error: addNewRow is not defined)
window.addNewRow = () => {
    documentItems.push({
        id: Date.now(),
        description: '',
        qty: 1,
        unit_price: 0,
        discount: 0,
        is_vat: false, // ค่าเริ่มต้น: ไม่คิด VAT
        is_wht: true   // ค่าเริ่มต้น: หัก ณ ที่จ่าย
    });
    renderTable();
};

window.removeRow = (index) => {
    documentItems.splice(index, 1);
    renderTable();
};

window.updateItem = (index, field, element) => {
    let value = element.type === 'checkbox' ? element.checked : element.value;
    if (['qty', 'unit_price', 'discount'].includes(field)) value = parseFloat(value) || 0;
    documentItems[index][field] = value;
    renderTable();
};

const formatTHB = (num) => `฿${num.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

function renderTable() {
    const tbody = document.getElementById('items_body');
    tbody.innerHTML = ''; 
    
    let totalBase = 0;
    let totalDiscount = 0;
    let totalVatBase = 0;
    let totalWhtBase = 0;

    documentItems.forEach((item, index) => {
        const itemTotal = item.qty * item.unit_price;
        const lineTotalAfterDiscount = itemTotal - item.discount;
        
        totalBase += itemTotal;
        totalDiscount += item.discount;
        
        // แยกฐานภาษี
        if (item.is_vat) totalVatBase += lineTotalAfterDiscount;
        if (item.is_wht) totalWhtBase += lineTotalAfterDiscount;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="text" value="${item.description}" onchange="updateItem(${index}, 'description', this)" placeholder="รายละเอียด"></td>
            <td><input type="number" value="${item.qty}" min="1" onchange="updateItem(${index}, 'qty', this)" style="text-align: center;"></td>
            <td><input type="number" value="${item.unit_price}" min="0" onchange="updateItem(${index}, 'unit_price', this)" style="text-align: right;"></td>
            <td><input type="number" value="${item.discount}" min="0" onchange="updateItem(${index}, 'discount', this)" style="text-align: right;"></td>
            <td style="text-align: center;"><input type="checkbox" ${item.is_vat ? 'checked' : ''} onchange="updateItem(${index}, 'is_vat', this)"></td>
            <td style="text-align: center;"><input type="checkbox" ${item.is_wht ? 'checked' : ''} onchange="updateItem(${index}, 'is_wht', this)"></td>
            <td style="text-align: right; font-weight: 500;">${formatTHB(lineTotalAfterDiscount)}</td>
            <td style="text-align: center;"><button type="button" class="btn-outline" style="color: red; border-color: red; padding: 0.2rem 0.5rem;" onclick="removeRow(${index})">X</button></td>
        `;
        tbody.appendChild(tr);
    });

    calculateGrandTotal(totalBase, totalDiscount, totalVatBase, totalWhtBase);
}

// ==========================================
// ส่วนที่ 4: การคำนวณยอดสรุป (Summary Box)
// ==========================================
function calculateGrandTotal(totalBase, totalDiscount, totalVatBase, totalWhtBase) {
    const afterDiscount = totalBase - totalDiscount;
    const vatAmount = totalVatBase * 0.07; // คำนวณ VAT 7% จากบรรทัดที่ติ๊ก
    
    // ดึงค่า % หัก ณ ที่จ่ายจาก Dropdown ตัวรวม
    const globalWhtRate = parseFloat(document.getElementById('global_wht_rate').value) || 0;
    const whtAmount = totalWhtBase * (globalWhtRate / 100);

    const netAmount = (afterDiscount + vatAmount) - whtAmount;

    // อัปเดตหน้าจอ
    document.getElementById('summary_base').textContent = formatTHB(totalBase);
    document.getElementById('summary_discount').textContent = `-${formatTHB(totalDiscount)}`;
    document.getElementById('summary_after_discount').textContent = formatTHB(afterDiscount);
    document.getElementById('summary_vat').textContent = formatTHB(vatAmount);
    document.getElementById('summary_wht').textContent = `-${formatTHB(whtAmount)}`;
    document.getElementById('net_amount_display').textContent = formatTHB(netAmount);
}

// ผูก Event ให้คำนวณใหม่เมื่อเปลี่ยน % หัก ณ ที่จ่ายตัวรวม
document.getElementById('global_wht_rate').addEventListener('change', renderTable);

// ==========================================
// ส่วนที่ 5: ระบบอัปโหลดไฟล์ (แสดงภาพตัวอย่าง)
// ==========================================
document.getElementById('file_upload').addEventListener('change', function(e) {
    const files = e.target.files;
    const grid = document.getElementById('thumbnail_grid');
    grid.innerHTML = ''; // ล้างรูปเก่า (ถ้าอยากให้เพิ่มรูปต่อกันได้ ให้ลบบรรทัดนี้)
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(event) {
            const div = document.createElement('div');
            div.style = "width: 80px; height: 80px; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb;";
            
            if(file.type.startsWith('image/')) {
                div.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else if (file.type === 'application/pdf') {
                div.innerHTML = `<div style="background: #f4f5f7; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#ef4444; font-size:12px; font-weight:bold;">PDF</div>`;
            }
            grid.appendChild(div);
        }
        reader.readAsDataURL(file);
    });
});

// เริ่มต้นระบบ
checkUser();
// สั่งสร้างตารางว่างๆ 1 บรรทัดเตรียมไว้ตอนโหลดหน้า
window.addNewRow();

// ==========================================
// ส่วนฟังก์ชันเสริม: อัปโหลดไฟล์ขึ้น Supabase Storage
// ==========================================
async function uploadFile(file, bucketName, folderPath) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${folderPath}/${fileName}`;

    // 1. อัปโหลดไฟล์ขึ้น Storage
    const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file);

    if (error) throw error;

    // 2. ขอ URL สำหรับดูไฟล์
    const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
}

// ==========================================
// ส่วนที่ 6: ระบบจัดการข้อมูลบริษัท (Company Settings) + โลโก้
// ==========================================
const companyForm = document.getElementById('company-form');
const logoUploadInput = document.getElementById('company_logo_upload');
const logoPreview = document.getElementById('company_logo_preview');

// เปลี่ยนรูป Preview ทันทีที่เลือกไฟล์โลโก้
logoUploadInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        logoPreview.src = URL.createObjectURL(e.target.files[0]);
    }
});

async function loadCompanySettings() {
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    if (data) {
        document.getElementById('comp_name').value = data.company_name || '';
        document.getElementById('comp_tax_id').value = data.tax_id || '';
        document.getElementById('comp_address').value = data.address || '';
        document.getElementById('comp_phone').value = data.phone || '';
        if (data.logo_url) logoPreview.src = data.logo_url;
        
        // เก็บ URL โลโก้เดิมไว้ซ่อนๆ เผื่อไม่มีการอัปเดตรูปใหม่
        logoPreview.setAttribute('data-original-url', data.logo_url || '');
    }
}

companyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = companyForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'กำลังบันทึกและอัปโหลด...';
    submitBtn.disabled = true;

    try {
        let finalLogoUrl = logoPreview.getAttribute('data-original-url');

        // ถ้ามีการเลือกไฟล์โลโก้ใหม่ ให้อัปโหลดขึ้น Storage ก่อน
        if (logoUploadInput.files.length > 0) {
            finalLogoUrl = await uploadFile(logoUploadInput.files[0], 'company_assets', 'logos');
        }

        const payload = {
            id: 1, 
            company_name: document.getElementById('comp_name').value,
            tax_id: document.getElementById('comp_tax_id').value,
            address: document.getElementById('comp_address').value,
            phone: document.getElementById('comp_phone').value,
            logo_url: finalLogoUrl, // บันทึกลิงก์รูปโลโก้ลงฐานข้อมูล
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('company_settings').upsert(payload);
        if (error) throw error;
        
        alert('บันทึกข้อมูลและโลโก้บริษัทสำเร็จ!');
    } catch (error) {
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
        submitBtn.textContent = 'บันทึกการตั้งค่า';
        submitBtn.disabled = false;
    }
});

// ==========================================
// ส่วนที่ 7: ระบบบันทึกใบสำคัญจ่าย (PV) + อัปโหลดไฟล์แนบ
// ==========================================
const pvForm = document.getElementById('pv-form');

pvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (documentItems.length === 0) return alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('กรุณาล็อกอินใหม่');

    const submitBtn = pvForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'กำลังบันทึกและอัปโหลดไฟล์...';
    submitBtn.disabled = true;

    try {
        const parseCurrency = (id) => parseFloat(document.getElementById(id).textContent.replace(/[^0-9.-]+/g,"")) || 0;
        
        // 1. บันทึกหัวเอกสาร (documents)
        const docPayload = {
            doc_no: `PV${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`,
            doc_type: 'pv',
            doc_date: document.getElementById('doc_date').value,
            vendor_name: document.getElementById('vendor_name').value,
            status: document.getElementById('doc_status_select').value,
            remarks: document.getElementById('remarks').value,
            total_amount_before_vat: parseCurrency('summary_base'),
            discount: parseCurrency('summary_discount'),
            vat_amount: parseCurrency('summary_vat'),
            wht_percent: parseFloat(document.getElementById('global_wht_rate').value) || 0,
            wht_amount: Math.abs(parseCurrency('summary_wht')),
            net_amount: parseCurrency('net_amount_display'),
            created_by: user.id
        };

        const { data: insertedDoc, error: docError } = await supabase.from('documents').insert([docPayload]).select('id').single();
        if (docError) throw docError;

        // 2. บันทึกรายการย่อย (document_items)
        const itemsPayload = documentItems.map(item => ({
            document_id: insertedDoc.id,
            description: item.description,
            qty: item.qty,
            unit_price: item.unit_price,
            item_discount: item.discount,
            is_vat: item.is_vat,
            is_wht: item.is_wht
        }));

        const { error: itemsError } = await supabase.from('document_items').insert(itemsPayload);
        if (itemsError) throw itemsError;

        // 3. จัดการอัปโหลดไฟล์แนบ (Attachments)
        const fileInput = document.getElementById('file_upload');
        if (fileInput.files.length > 0) {
            const attachmentPayload = [];
            for (const file of fileInput.files) {
                // อัปโหลดไฟล์ขึ้น Storage
                const fileUrl = await uploadFile(file, 'document_files', `pv_attachments/${insertedDoc.id}`);
                
                // เตรียมข้อมูลเพื่อเซฟลิงก์ลงฐานข้อมูล
                attachmentPayload.push({
                    document_id: insertedDoc.id,
                    file_url: fileUrl,
                    file_name: file.name
                });
            }
            
            // บันทึกข้อมูลลิงก์ไฟล์ลงตาราง attachments
            if (attachmentPayload.length > 0) {
                const { error: attachError } = await supabase.from('attachments').insert(attachmentPayload);
                if (attachError) console.error("Attachment Error:", attachError);
            }
        }

        alert('บันทึกใบสำคัญจ่ายและไฟล์แนบเรียบร้อยแล้ว!');
        
        pvForm.reset();
        documentItems = []; 
        document.getElementById('thumbnail_grid').innerHTML = ''; // ล้างรูปตัวอย่าง
        window.addNewRow(); 
        document.querySelector('[data-page="document-list"]').click(); 

    } catch (error) {
        console.error("Error saving document:", error);
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
        submitBtn.textContent = 'บันทึกเอกสาร';
        submitBtn.disabled = false;
    }
});

// เรียกดึงข้อมูลบริษัททันที
loadCompanySettings();

// ==========================================
// ส่วนที่ 8: ระบบแสดงรายการเอกสาร (Document List) และ Dashboard
// ==========================================

// ฟังก์ชันดึงข้อมูลเอกสารทั้งหมดจาก Supabase
async function loadDocuments() {
    const tbody = document.getElementById('doc_list_body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">กำลังโหลดข้อมูล...</td></tr>';

    // ดึงข้อมูลจากตาราง documents เรียงจากใหม่ไปเก่า
    const { data, error } = await supabase
        .from('documents')
        .select('id, doc_no, doc_date, vendor_name, net_amount, status')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching documents:", error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">เกิดข้อผิดพลาด: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6b7280;">ยังไม่มีเอกสารในระบบ ลองสร้างใบสำคัญจ่ายดูสิ!</td></tr>';
        updateDashboardStats(0, 0); // อัปเดต Dashboard เป็น 0
        return;
    }

    tbody.innerHTML = '';
    let pendingCount = 0;
    let paidSum = 0;

    // วนลูปสร้างตารางทีละบรรทัด
    data.forEach(doc => {
        // --- 1. คำนวณข้อมูลสำหรับ Dashboard ---
        if (doc.status === 'pending') pendingCount++;
        if (doc.status === 'paid') paidSum += parseFloat(doc.net_amount) || 0;

        // --- 2. ตกแต่งป้ายสถานะ (Badge) ให้สวยงาม ---
        let statusBadge = '';
        switch(doc.status) {
            case 'draft': 
                statusBadge = '<span style="background:#f3f4f6; color:#374151; padding:4px 8px; border-radius:12px; font-size:0.85em;">ร่าง (Draft)</span>'; break;
            case 'pending': 
                statusBadge = '<span style="background:#fef3c7; color:#d97706; padding:4px 8px; border-radius:12px; font-size:0.85em; font-weight:bold;">รออนุมัติ</span>'; break;
            case 'approved': 
                statusBadge = '<span style="background:#dbeafe; color:#2563eb; padding:4px 8px; border-radius:12px; font-size:0.85em;">อนุมัติแล้ว</span>'; break;
            case 'paid': 
                statusBadge = '<span style="background:#d1fae5; color:#059669; padding:4px 8px; border-radius:12px; font-size:0.85em; font-weight:bold;">ชำระเงินแล้ว</span>'; break;
        }

        // --- 3. สร้างแถวข้อมูล HTML ---
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 500;">${doc.doc_no}</td>
            <td>${doc.doc_date}</td>
            <td>${doc.vendor_name}</td>
            <td style="text-align: right; font-weight: bold; color: #10b981;">฿${parseFloat(doc.net_amount).toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: center;">
                <button class="btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.85rem;" onclick="printDocument('${doc.id}')">🖨️ พิมพ์เอกสาร</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // อัปเดตตัวเลขหน้า Dashboard
    updateDashboardStats(pendingCount, paidSum);
}

// ฟังก์ชันอัปเดตตัวเลขหน้า Dashboard
function updateDashboardStats(pending, paidSum) {
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-paid').textContent = `฿${paidSum.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
}

// ผูก Event: ให้รีเฟรชข้อมูลทุกครั้งที่กดเมนู "รายการเอกสารทั้งหมด" หรือ "Dashboard"
document.querySelector('[data-page="document-list"]').addEventListener('click', loadDocuments);
document.querySelector('[data-page="dashboard"]').addEventListener('click', loadDocuments);

// สั่งโหลดข้อมูลทันทีเมื่อเปิดแอปขึ้นมาครั้งแรก
loadDocuments();
// ==========================================
// ส่วนที่ 10: ระบบสร้างเอกสาร PDF (Print View)
// ==========================================

// ทำให้ HTML รู้จักฟังก์ชันนี้เมื่อกดปุ่ม "พิมพ์เอกสาร"
window.printDocument = async (documentId) => {
    try {
        // 1. ดึงข้อมูลหัวเอกสาร (PV)
        const { data: docData, error: docErr } = await supabase.from('documents').select('*').eq('id', documentId).single();
        if (docErr) throw docErr;

        // 2. ดึงข้อมูลรายการย่อยทั้งหมดของเอกสารนี้
        const { data: itemsData, error: itemsErr } = await supabase.from('document_items').select('*').eq('document_id', documentId);
        if (itemsErr) throw itemsErr;

        // 3. ดึงข้อมูลบริษัท
        const { data: compData } = await supabase.from('company_settings').select('*').eq('id', 1).single();

        // --- นำข้อมูลยัดใส่หน้ากระดาษ A4 ---
        
        // ข้อมูลบริษัท
        if (compData) {
            document.getElementById('print_comp_name').textContent = compData.company_name || 'ชื่อบริษัท';
            document.getElementById('print_comp_address').textContent = compData.address || '-';
            document.getElementById('print_comp_tax').textContent = compData.tax_id || '-';
            document.getElementById('print_comp_phone').textContent = compData.phone || '-';
            
            const logoImg = document.getElementById('print_logo');
            if (compData.logo_url) {
                logoImg.src = compData.logo_url;
                logoImg.style.display = 'block';
            } else {
                logoImg.style.display = 'none';
            }
        }

        // ข้อมูลเอกสาร
        document.getElementById('print_doc_no').textContent = docData.doc_no;
        document.getElementById('print_doc_date').textContent = docData.doc_date;
        document.getElementById('print_vendor_name').textContent = docData.vendor_name;
        document.getElementById('print_remarks').textContent = docData.remarks || '-';

        // วาดตารางรายการสินค้า
        const tbody = document.getElementById('print_items_body');
        tbody.innerHTML = '';
        itemsData.forEach(item => {
            const tr = document.createElement('tr');
            const itemTotal = (item.qty * item.unit_price) - item.item_discount;
            tr.innerHTML = `
                <td style="border: 1px solid #000; padding: 8px;">${item.description}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: center;">${item.qty}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${item.unit_price.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${item.item_discount > 0 ? item.item_discount.toLocaleString('th-TH', {minimumFractionDigits: 2}) : '-'}</td>
                <td style="border: 1px solid #000; padding: 8px; text-align: right;">${itemTotal.toLocaleString('th-TH', {minimumFractionDigits: 2})}</td>
            `;
            tbody.appendChild(tr);
        });

        // สรุปยอดเงิน
        const formatTHB = (num) => `฿${parseFloat(num).toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
        document.getElementById('print_total_base').textContent = formatTHB(docData.total_amount_before_vat);
        document.getElementById('print_total_vat').textContent = formatTHB(docData.vat_amount);
        document.getElementById('print_total_wht').textContent = `-${formatTHB(docData.wht_amount)}`;
        document.getElementById('print_net_amount').textContent = formatTHB(docData.net_amount);

        // --- สลับหน้าจอไปที่หน้า Print View ---
        document.querySelectorAll('.page-view').forEach(page => page.style.display = 'none');
        document.getElementById('view-print').style.display = 'block';

    } catch (error) {
        alert("เกิดข้อผิดพลาดในการดึงข้อมูลเพื่อพิมพ์: " + error.message);
    }
};
