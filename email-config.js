/* ═══════════════════════════════════════════════
   MORPHII — EmailJS Configuration
   ═══════════════════════════════════════════════

   ⚠️  SETUP — 3 values to fill in below.

   EmailJS sends the "here's your code" confirmation
   email directly from the browser — no backend, no
   Cloud Functions, works on Firebase's free Spark plan.

   Steps:
   1. Go to https://www.emailjs.com and sign up (free
      tier: ~200 emails/month).
   2. Email Services → Add New Service → connect the
      Gmail (or other) account you want to send from →
      copy the Service ID.
   3. Email Templates → Create New Template. Use these
      variable names in the template body so they match
      what create.js sends:
        {{to_email}}   — recipient
        {{to_name}}    — customer's name
        {{code}}       — the save code
        {{product}}    — product label
        {{size}}       — size in inches
      Write the body to explain: 1) pay on Shopee for
      this product, 2) send this code via Shopee chat.
      Copy the Template ID.
   4. Account → General → copy your Public Key.
   5. Paste all three values below.
   ═══════════════════════════════════════════════ */

const EMAILJS_CONFIG = {
  publicKey: 'RkLPj3FJdxbTIfngc',
  serviceId: 'service_xuv2xhp',
  templateId: 'template_d37gxpe',
};

const _emailReady = !EMAILJS_CONFIG.publicKey.includes('PASTE');
if (_emailReady && typeof emailjs !== 'undefined') {
  try { emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey }); } catch(e) {}
}

// Fire-and-forget — a failed email should never block the order submission,
// since the order (and code) are already safely saved in Firestore either way.
function sendConfirmationEmail(params){
  if (!_emailReady || typeof emailjs === 'undefined') {
    console.warn('EmailJS not configured yet — see email-config.js');
    return Promise.resolve({ sent:false, reason:'not_configured' });
  }
  return emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, params)
    .then(() => ({ sent:true }))
    .catch(err => { console.warn('Confirmation email failed:', err); return { sent:false, reason:'send_error', err }; });
}
