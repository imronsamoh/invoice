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
// ส่วนที่ 6: ระบบจัดการข้อมูลบริษัท (Company Settings)
// ==========================================
const companyForm = document.getElementById('company-form');

// ฟังก์ชันดึงข้อมูลบริษัทมาแสดงเมื่อโหลดหน้าเว็บ
async function loadCompanySettings() {
    const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (data) {
        document.getElementById('comp_name').value = data.company_name || '';
        document.getElementById('comp_tax_id').value = data.tax_id || '';
        document.getElementById('comp_address').value = data.address || '';
        document.getElementById('comp_phone').value = data.phone || '';
        // หมายเหตุ: ส่วนดึงรูปภาพโลโก้จะทำเพิ่มในอนาคตเมื่อระบบ Storage สมบูรณ์
    }
}

// เมื่อกดปุ่มบันทึกตั้งค่าบริษัท
companyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = companyForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'กำลังบันทึก...';
    submitBtn.disabled = true;

    // เตรียมข้อมูล (บังคับใช้ id: 1 เพื่อให้มีแค่บรรทัดเดียวเสมอ)
    const payload = {
        id: 1, 
        company_name: document.getElementById('comp_name').value,
        tax_id: document.getElementById('comp_tax_id').value,
        address: document.getElementById('comp_address').value,
        phone: document.getElementById('comp_phone').value,
        updated_at: new Date().toISOString()
    };

    // ใช้คำสั่ง upsert (ถ้ามีข้อมูลแล้วให้อัปเดต ถ้าไม่มีให้สร้างใหม่)
    const { data, error } = await supabase
        .from('company_settings')
        .upsert(payload);

    submitBtn.textContent = 'บันทึกการตั้งค่า';
    submitBtn.disabled = false;

    if (error) {
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
        alert('บันทึกข้อมูลบริษัทสำเร็จ!');
    }
});

// ==========================================
// ส่วนที่ 7: ระบบบันทึกเอกสารใบสำคัญจ่าย (PV) + รายการย่อย
// ==========================================
const pvForm = document.getElementById('pv-form');

pvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // ตรวจสอบว่ามีการเพิ่มรายการสินค้าหรือยัง
    if (documentItems.length === 0) {
        return alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('กรุณาล็อกอินใหม่');

    const submitBtn = pvForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'กำลังบันทึกเอกสาร...';
    submitBtn.disabled = true;

    try {
        // 1. ดึงค่ายอดสรุปจากหน้าจอ (เอาลูกน้ำและสัญลักษณ์ ฿ ออก)
        const parseCurrency = (id) => parseFloat(document.getElementById(id).textContent.replace(/[^0-9.-]+/g,"")) || 0;
        
        const totalBase = parseCurrency('summary_base');
        const totalVat = parseCurrency('summary_vat');
        const totalWht = Math.abs(parseCurrency('summary_wht')); // ทำให้เป็นค่าบวก
        const netAmount = parseCurrency('net_amount_display');
        const globalWhtRate = parseFloat(document.getElementById('global_wht_rate').value) || 0;

        // 2. เตรียมข้อมูลหัวเอกสาร (ตาราง documents)
        const docPayload = {
            doc_no: `PV${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`,
            doc_type: 'pv',
            doc_date: document.getElementById('doc_date').value,
            vendor_name: document.getElementById('vendor_name').value,
            status: document.getElementById('doc_status_select').value,
            remarks: document.getElementById('remarks').value,
            total_amount_before_vat: totalBase,
            vat_amount: totalVat,
            wht_percent: globalWhtRate,
            wht_amount: totalWht,
            net_amount: netAmount,
            created_by: user.id
        };

        // 3. บันทึกหัวเอกสาร และขอ ID ที่เพิ่งสร้างกลับมา
        const { data: insertedDoc, error: docError } = await supabase
            .from('documents')
            .insert([docPayload])
            .select('id')
            .single();

        if (docError) throw docError;

        // 4. เตรียมข้อมูลรายการย่อย (ตาราง document_items) โดยผูกกับ Document ID ใหม่
        const itemsPayload = documentItems.map(item => ({
            document_id: insertedDoc.id,
            description: item.description,
            qty: item.qty,
            unit_price: item.unit_price,
            item_discount: item.discount,
            is_vat: item.is_vat,
            is_wht: item.is_wht
        }));

        // 5. บันทึกรายการย่อย
        const { error: itemsError } = await supabase
            .from('document_items')
            .insert(itemsPayload);

        if (itemsError) throw itemsError;

        // ถ้าทุกอย่างผ่าน
        alert('บันทึกใบสำคัญจ่ายเรียบร้อยแล้ว!');
        
        // รีเซ็ตฟอร์ม
        pvForm.reset();
        documentItems = []; // ล้าง Array รายการ
        window.addNewRow(); // สร้างบรรทัดว่างรอไว้ 1 บรรทัด
        
        // พาผู้ใช้กลับไปหน้า Dashboard หรือหน้ารายการ
        document.querySelector('[data-page="document-list"]').click(); 

    } catch (error) {
        console.error("Error saving document:", error);
        alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
        submitBtn.textContent = 'บันทึกเอกสาร';
        submitBtn.disabled = false;
    }
});

// เรียกดึงข้อมูลบริษัททันทีที่เปิดแอป
loadCompanySettings();
