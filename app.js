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
