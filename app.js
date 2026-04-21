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
// ส่วนที่ 7: ฟอร์มสร้างใบสำคัญจ่าย (PV) - แบบสมบูรณ์
// ==========================================
const pvForm = document.getElementById('pv-form');
const baseAmountInput = document.getElementById('base_amount');
const discountInput = document.getElementById('discount');
const vatRateSelect = document.getElementById('vat_rate');
const whtRateSelect = document.getElementById('wht_rate');
const otherDeductionsInput = document.getElementById('other_deductions');

// ฟังก์ชันคำนวณยอดเงินทั้งหมด
function calculateFinancials() {
    const base = parseFloat(baseAmountInput.value) || 0;
    const discount = parseFloat(discountInput.value) || 0;
    const vatRate = parseFloat(vatRateSelect.value) || 0;
    const whtRate = parseFloat(whtRateSelect.value) || 0;
    const otherDed = parseFloat(otherDeductionsInput.value) || 0;

    // 1. ยอดหลังหักส่วนลด (ฐานในการคิดภาษี)
    const afterDiscount = Math.max(0, base - discount);

    // 2. คำนวณ VAT (จากยอดหลังหักส่วนลด)
    const vatAmount = afterDiscount * (vatRate / 100);

    // 3. คำนวณ หัก ณ ที่จ่าย (จากยอดหลังหักส่วนลด ก่อนรวม VAT)
    const whtAmount = afterDiscount * (whtRate / 100);

    // 4. ยอดสุทธิ = (ยอดฐาน + VAT) - หัก ณ ที่จ่าย - หักอื่นๆ
    const netAmount = (afterDiscount + vatAmount) - whtAmount - otherDed;

    // ฟังก์ชันช่วย Format ตัวเลขเป็นเงินบาท
    const formatTHB = (num) => `฿${num.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;

    // แสดงผลบนหน้าเว็บ
    document.getElementById('summary_after_discount').textContent = formatTHB(afterDiscount);
    document.getElementById('summary_vat').textContent = formatTHB(vatAmount);
    document.getElementById('summary_wht').textContent = `-${formatTHB(whtAmount)}`;
    document.getElementById('summary_other').textContent = `-${formatTHB(otherDed)}`;
    document.getElementById('net_amount_display').textContent = formatTHB(netAmount);

    return { base, discount, afterDiscount, vatRate, vatAmount, whtRate, whtAmount, otherDed, netAmount };
}

// ผูก Event ให้คำนวณอัตโนมัติเมื่อมีการพิมพ์หรือเปลี่ยนตัวเลือก
[baseAmountInput, discountInput, vatRateSelect, whtRateSelect, otherDeductionsInput].forEach(input => {
    input.addEventListener('input', calculateFinancials);
    input.addEventListener('change', calculateFinancials);
});

// จัดการการส่งข้อมูล (Submit)
pvForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('กรุณาล็อกอินใหม่');

    const calc = calculateFinancials();

    // สร้าง Payload ให้ตรงกับโครงสร้างฐานข้อมูล
    const payload = {
        doc_no: `PV${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`,
        doc_type: 'pv',
        doc_date: document.getElementById('doc_date').value,
        vendor_name: document.getElementById('vendor_name').value, // บันทึกชื่อผู้รับเงิน
        remarks: document.getElementById('remarks').value,
        total_amount_before_vat: calc.afterDiscount, // เก็บยอดหลังหักส่วนลดเป็นฐาน
        discount: calc.discount,
        vat_percent: calc.vatRate,
        vat_amount: calc.vatAmount,
        wht_percent: calc.whtRate,
        wht_amount: calc.whtAmount,
        other_deductions: calc.otherDed,
        net_amount: calc.netAmount,
        created_by: user.id
    };

    const submitBtn = pvForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'กำลังบันทึก...';
    submitBtn.disabled = true;

    const { data, error } = await supabase
        .from('documents')
        .insert([payload]);

    submitBtn.textContent = 'บันทึกเอกสาร';
    submitBtn.disabled = false;

    if (error) {
        console.error('Error saving:', error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } else {
        alert('บันทึกใบสำคัญจ่ายสำเร็จ!');
        pvForm.reset();
        calculateFinancials(); 
        document.querySelector('[data-page="dashboard"]').click(); 
    }
});
