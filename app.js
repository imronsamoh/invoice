import { supabase } from './supabaseClient.js';

// DOM Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const errorMsg = document.getElementById('login-error');
const userEmailDisplay = document.getElementById('user-email');

// --- 1. ตรวจสอบสถานะการเข้าสู่ระบบเมื่อเปิดเว็บ ---
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showApp(session.user);
    } else {
        showLogin();
    }
}

// --- 2. ฟังก์ชันแสดงหน้า UI ---
function showApp(user) {
    loginSection.style.display = 'none';
    appSection.style.display = 'flex';
    userEmailDisplay.textContent = user.email;
}

function showLogin() {
    loginSection.style.display = 'flex';
    appSection.style.display = 'none';
}

// --- 3. จัดการการ Submit ฟอร์ม Login ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // ป้องกันหน้าเว็บ Refresh
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    loginBtn.textContent = 'กำลังตรวจสอบ...';
    loginBtn.disabled = true;
    errorMsg.style.display = 'none';

    // ส่งคำขอ Login ไปที่ Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        errorMsg.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        errorMsg.style.display = 'block';
        loginBtn.textContent = 'เข้าสู่ระบบ';
        loginBtn.disabled = false;
    } else {
        // ล็อกอินสำเร็จ
        loginForm.reset();
        loginBtn.textContent = 'เข้าสู่ระบบ';
        loginBtn.disabled = false;
        showApp(data.user);
    }
});

// --- 4. จัดการปุ่ม Logout ---
logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    showLogin();
});

// --- 5. จัดการเมนู Sidebar (เปิด/ปิด บนมือถือ) ---
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

// เริ่มทำงานเมื่อไฟล์ถูกโหลด
checkUser();

// ==========================================
// ส่วนที่ 6: ระบบจัดการเมนู (Navigation)
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const pageViews = document.querySelectorAll('.page-view');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // 1. เปลี่ยนแถบสีเมนูที่โดนคลิก
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // 2. ซ่อนทุกหน้า และแสดงเฉพาะหน้าที่เลือก
        const targetPage = item.getAttribute('data-page');
        pageViews.forEach(page => page.style.display = 'none');
        document.getElementById(`view-${targetPage}`).style.display = 'block';

        // 3. ปิด Sidebar อัตโนมัติ (สำหรับมือถือ)
        sidebar.classList.remove('open');
    });
});

// ==========================================
// ส่วนที่ 7: ฟอร์มสร้างใบสำคัญจ่าย (PV)
// ==========================================
const pvForm = document.getElementById('pv-form');
const baseAmountInput = document.getElementById('base_amount');
const whtRateSelect = document.getElementById('wht_rate');
const netAmountDisplay = document.getElementById('net_amount_display');

// ฟังก์ชันคำนวณยอดเงินแบบ Real-time
function calculateNet() {
    const base = parseFloat(baseAmountInput.value) || 0;
    const whtRate = parseFloat(whtRateSelect.value) || 0;
    const whtAmount = base * (whtRate / 100);
    const net = base - whtAmount; // สมมติว่ายังไม่มี VAT เพื่อความเข้าใจง่ายก่อน
    
    // แสดงผลใส่ลูกน้ำแบบสวยๆ
    netAmountDisplay.textContent = `฿${net.toLocaleString('th-TH', {minimumFractionDigits: 2})}`;
    return { base, whtRate, whtAmount, net };
}

// ผูก Event ให้คำนวณทุกครั้งที่พิมพ์ตัวเลข หรือเปลี่ยน % หัก ณ ที่จ่าย
baseAmountInput.addEventListener('input', calculateNet);
whtRateSelect.addEventListener('change', calculateNet);

// ฟังก์ชันส่งข้อมูลเข้า Supabase
pvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 1. ดึงข้อมูลว่าใครล็อกอินอยู่ (เพื่อบันทึกว่าใครสร้างเอกสาร)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('กรุณาล็อกอินใหม่');

    // 2. คำนวณยอด
    const calc = calculateNet();

    // 3. เตรียมข้อมูล
    const payload = {
        doc_no: `PV${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`, // สุ่มเลข PV ชั่วคราว
        doc_type: 'pv',
        doc_date: document.getElementById('doc_date').value,
        remarks: document.getElementById('remarks').value,
        total_amount_before_vat: calc.base,
        wht_percent: calc.whtRate,
        wht_amount: calc.whtAmount,
        net_amount: calc.net,
        created_by: user.id
    };

    // 4. ส่งเข้าฐานข้อมูล
    const { data, error } = await supabase
        .from('documents')
        .insert([payload]);

    if (error) {
        console.error('Error saving:', error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
        alert('บันทึกใบสำคัญจ่ายสำเร็จ!');
        pvForm.reset();
        calculateNet(); // รีเซ็ตยอดโชว์
        // เปลี่ยนกลับไปหน้า Dashboard
        document.querySelector('[data-page="dashboard"]').click(); 
    }
});
