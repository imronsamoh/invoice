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
