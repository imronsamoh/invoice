// ดึงไลบรารีจาก Window ที่เราฝังไว้ใน index.html
const { createClient } = window.supabase;

// นำค่าเหล่านี้มาจากเมนู Settings > API ใน Supabase Project ของคุณ
const supabaseUrl = 'https://wgfnlwcgqzrjqkfouvwn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZm5sd2NncXpyanFrZm91dnduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjQyNDksImV4cCI6MjA5MjMwMDI0OX0.R7Jk6-WYr_D41iv6PoVmpctK-7NWqpXfUpuq8EAziN0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
