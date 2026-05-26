// app/privacy/page.tsx
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-2xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-black text-orange-400 mb-2">سياسة الخصوصية</h1>
      <p className="text-xs text-white/30 font-mono mb-8">آخر تحديث: مايو 2025 · Crypto Terminal 360</p>

      {[
        { title: '1. البيانات التي نجمعها', body: 'نجمع فقط معرّف Telegram الخاص بك (User ID) لغرض التحقق من الاشتراك في القناة وحفظ تفضيلاتك. لا نجمع بيانات مالية أو بيانات شخصية حساسة.' },
        { title: '2. استخدام البيانات', body: 'تُستخدم البيانات المجمّعة حصراً لتقديم الخدمة وتحسين تجربة المستخدم. لا نبيع بياناتك لأي طرف ثالث ولا نشاركها لأغراض تجارية.' },
        { title: '3. التخزين والأمان', body: 'يتم تخزين تفضيلاتك في Supabase مع تطبيق سياسات أمان Row Level Security. يتم تخزين سجل التحليلات في متصفحك المحلي فقط ولا يُرسل إلى خوادمنا.' },
        { title: '4. خدمات الطرف الثالث', body: 'يستخدم التطبيق بيانات من Binance (أسعار لحظية) وCoinGecko (بيانات السوق) وalternative.me (مؤشر الخوف والجشع). تخضع هذه البيانات لسياسات خصوصية مزوّديها.' },
        { title: '5. حقوقك', body: 'يحق لك طلب حذف بياناتك في أي وقت بالتواصل معنا عبر القنوات الرسمية. سيتم تنفيذ طلب الحذف خلال 30 يوم عمل.' },
      ].map(s => (
        <section key={s.title} className="mb-6">
          <h2 className="text-sm font-bold text-white/70 mb-2">{s.title}</h2>
          <p className="text-sm text-white/40 leading-relaxed">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
