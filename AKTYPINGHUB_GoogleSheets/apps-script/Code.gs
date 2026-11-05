/**
 * AKTYPINGHUB Google Sheets order desk (Google Apps Script)
 * Bind this script to a private Google Sheet. Deploy as web app:
 * Execute as: Me | Who has access: Anyone.
 * Set script property ADMIN_SECRET to a long, private random passphrase.
 * Do NOT publish this script's bound Sheet or admin secret.
 */
const CUSTOMER_SHEET = 'Customers';
const ORDER_SHEET = 'Orders';
const SITE_URL = 'https://amankumarmecs.github.io/';
const CUSTOMER_HEADERS = ['Phone','Name','FirstOrderID','ReferralCode','ReferredByPhone','RewardEarned','RewardUsed','CreatedAt'];
const ORDER_HEADERS = ['OrderID','CreatedAt','Phone','Name','Service','Copies','Notes','ReferralCodeUsed','DiscountPercent','Status','ReferredByPhone','UpdatedAt','SubmissionKey'];
const SERVICES = [
  'Black & White Printing', 'Colour Printing', 'Typing & Formatting',
  'School Papers & Projects', 'Photocopying', 'Scanning',
  'Passport Photo Printing', 'Custom Photo & Frame Prints', 'Other Enquiry'
];
const STATUS = ['received','quoted','in_progress','completed','cancelled'];
const C = { PHONE:0, NAME:1, FIRST:2, REF:3, BY:4, EARNED:5, USED:6, CREATED:7 };
const O = { ID:0, DATE:1, PHONE:2, NAME:3, SERVICE:4, COPIES:5, NOTES:6, REF:7, DISCOUNT:8, STATUS:9, BY:10, UPDATED:11, KEY:12 };

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open Extensions > Apps Script from your private Google Sheet first.');
  const customers = ensureSheet_(ss, CUSTOMER_SHEET, CUSTOMER_HEADERS);
  const orders = ensureSheet_(ss, ORDER_SHEET, ORDER_HEADERS);
  customers.getRange('A:A').setNumberFormat('@');
  orders.getRange('C:C').setNumberFormat('@');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',ss.getId());
  Logger.log('AKTYPINGHUB sheets initialized. Now set script property ADMIN_SECRET manually.');
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#e8f1eb');
    sheet.setFrozenRows(1);
  } else {
    const existing = sheet.getRange(1,1,1,headers.length).getValues()[0];
    if (headers.some((h,i)=>existing[i] !== h)) throw new Error(name+' sheet headers changed. Restore the template headers.');
  }
  return sheet;
}
function sheet_(name) {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Owner setup is incomplete. Run setup() first.');
  const sh = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sh) throw new Error('Required private sheet missing: '+name);
  return sh;
}
function rows_(name) {
  const sh=sheet_(name), count=sh.getLastRow();
  if(count<2) return [];
  return sh.getRange(2,1,count-1,name===CUSTOMER_SHEET?CUSTOMER_HEADERS.length:ORDER_HEADERS.length).getValues();
}
function normalizePhone_(value) {
  let phone = String(value||'').replace(/\D/g,'');
  if(phone.length===12 && phone.startsWith('91')) phone=phone.slice(2);
  if(!/^[6-9][0-9]{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
  return phone;
}
function text_(v,max) {
  const s=String(v==null?'':v).trim();
  if(s.length>max) throw new Error('One of the fields is too long.');
  return s;
}
function cell_(value) {
  const s=String(value == null ? '' : value);
  // Prevent Sheets interpreting user-controlled input as a formula.
  return /^\s*[=+\-@\t\r]/.test(s) ? "'"+s : s;
}
function escape_(value) {
  return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function newRef_() {
  return 'AK-'+Utilities.formatDate(new Date(),'Asia/Kolkata','yyyyMMdd')+'-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
}
function newReferral_(allCustomers) {
  for(let i=0;i<10;i++) {
    const code='AKH'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
    if(!allCustomers.some(r=>String(r[C.REF])===code)) return code;
  }
  throw new Error('Could not generate a unique referral code. Try again.');
}
function lock_(task) {
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try { return task(); } finally { lock.releaseLock(); }
}

// Native HTML form posts from GitHub Pages work without CORS and need no client-side secrets.
function doPost(e) {
  try {
    const p=e && e.parameter ? e.parameter : {};
    const action=String(p.action||'');
    if(action==='create') return createOrderPage_(p);
    if(action==='track') return trackPage_(p);
    return page_('Invalid request','Please return to the website and try again.',true);
  } catch(ex) {
    console.error(ex && ex.stack ? ex.stack : ex);
    return page_('Request could not be processed', escape_(ex.message||'Please try again.'),true);
  }
}
function doGet(e) {
  const view=e && e.parameter && e.parameter.view;
  if(view==='admin') return HtmlService.createHtmlOutputFromFile('Admin').setTitle('AKTYPINGHUB | Private Dashboard');
  return page_('AKTYPINGHUB Order Desk','Use the secure order-request form on our website. <a href="'+SITE_URL+'">Back to AKTYPINGHUB</a>.',false);
}
function createOrderPage_(p) {
  const result=createOrder_(p);
  const discount=result.discount+'%';
  const msg='<p>Your request was recorded in our private order sheet.</p>'+
    '<div class="reference">'+escape_(result.id)+'</div>'+
    '<p><strong>Applied offer:</strong> '+escape_(discount)+' ('+escape_(result.offerDescription)+')</p>'+
    '<p>Save your reference. The discount is subject to eligible final billing and order confirmation.</p>'+
    '<a class="link" href="'+SITE_URL+'#track">Track your order on AKTYPINGHUB</a>';
  return page_('Request Received ✓',msg,false);
}
function createOrder_(p) {
  const name=text_(p.name,80), phone=normalizePhone_(p.phone),service=text_(p.service,80);
  const copies=Number(p.copies),notes=text_(p.notes,1000);
  const ref=text_(p.referral,15).toUpperCase();
  const key=text_(p.submissionKey,90);
  if(name.length<2) throw new Error('Name must contain at least two characters.');
  if(!SERVICES.includes(service)) throw new Error('Choose a valid service.');
  if(!Number.isInteger(copies)||copies<1||copies>10000) throw new Error('Quantity must be from 1 to 10,000.');
  if(String(p.consent||'')!=='yes') throw new Error('Consent is required to submit an enquiry.');
  if(p.website) throw new Error('Unable to accept this request.'); // honeypot
  if(ref && !/^AKH[A-Z0-9]{8}$/.test(ref)) throw new Error('Invalid referral code format.');
  if(key && !/^[A-Za-z0-9-]{12,90}$/.test(key)) throw new Error('Please reload the form and retry.');
  return lock_(function() {
    const orders=rows_(ORDER_SHEET),customers=rows_(CUSTOMER_SHEET);
    if(key) {
      const existing=orders.find(r=>String(r[O.KEY])===key);
      if(existing) {
        if(String(existing[O.PHONE])!==phone) throw new Error('Duplicate submission token. Reload the page.');
        return {id:String(existing[O.ID]),discount:Number(existing[O.DISCOUNT]),offerDescription:'Already submitted'};
      }
    }
    const customerIdx=customers.findIndex(r=>String(r[C.PHONE])===phone);
    let discount=0, referrerPhone='',rewardRedeem=false;
    if(customerIdx===-1) {
      discount=2;
      if(ref) {
        const referring=customers.find(r=>String(r[C.REF])===ref);
        if(!referring || String(referring[C.PHONE])===phone) throw new Error('Referral code not found or not eligible.');
        const completed=orders.some(r=>String(r[O.ID])===String(referring[C.FIRST]) && String(r[O.STATUS])==='completed');
        if(!completed) throw new Error('This referral code is not active yet.');
        referrerPhone=String(referring[C.PHONE]);
      }
    } else {
      if(ref) throw new Error('Referral codes can only be applied by first-time customers.');
      if(String(customers[customerIdx][C.EARNED])==='yes' && String(customers[customerIdx][C.USED])!=='yes') {
        discount=5;
        rewardRedeem=true;
      }
    }
    const orderId=newRef_(), now=new Date().toISOString();
    sheet_(ORDER_SHEET).appendRow([orderId,now,phone,cell_(name),service,copies,cell_(notes),ref,discount,'received',referrerPhone,now,key]);
    if(customerIdx===-1) {
      const code=newReferral_(customers);
      sheet_(CUSTOMER_SHEET).appendRow([phone,cell_(name),orderId,code,referrerPhone,'no','no',now]);
    } else if(rewardRedeem) {
      sheet_(CUSTOMER_SHEET).getRange(customerIdx+2,C.USED+1).setValue('yes');
    }
    return {id:orderId,discount,offerDescription:discount===2?'Welcome offer':discount===5?'One-time referral reward':'No offer on this request'};
  });
}
function trackPage_(p) {
  const id=text_(p.id,40).toUpperCase(),phone=normalizePhone_(p.phone);
  if(!/^AK-[0-9]{8}-[A-Z0-9]{12}$/.test(id)) throw new Error('Please enter a valid order reference.');
  const orders=rows_(ORDER_SHEET),customers=rows_(CUSTOMER_SHEET);
  const order=orders.find(r=>String(r[O.ID])===id && String(r[O.PHONE])===phone);
  if(!order) throw new Error('No matching order found. Check the reference and mobile number.');
  let body='<p><strong>Order:</strong> '+escape_(order[O.ID])+'</p><p><strong>Service:</strong> '+escape_(order[O.SERVICE])+'</p>'+
    '<p><strong>Status:</strong> '+escape_(String(order[O.STATUS]).replace(/_/g,' '))+'</p><p><strong>Discount:</strong> '+escape_(order[O.DISCOUNT])+'%</p>';
  const customer=customers.find(r=>String(r[C.PHONE])===phone);
  if(customer) {
    const completedFirst=orders.some(r=>String(r[O.ID])===String(customer[C.FIRST]) && String(r[O.STATUS])==='completed');
    if(completedFirst) {
      const code=String(customer[C.REF]);
      body+='<p><strong>Your referral code:</strong> '+escape_(code)+'</p>'+
        '<p><a class="link" href="'+SITE_URL+'?ref='+encodeURIComponent(code)+'">Your referral link</a></p>';
    }
    if(String(customer[C.EARNED])==='yes' && String(customer[C.USED])!=='yes') {
      body+='<p class="reward">Your one-time 5% referral reward is available for your next order.</p>';
    }
  }
  body+='<a class="link" href="'+SITE_URL+'">Back to AKTYPINGHUB</a>';
  return page_('Order Status',body,false);
}
function page_(title,html,isError) {
  const style='<style>body{margin:0;background:#f6f5ed;color:#073f35;font-family:system-ui,Arial,sans-serif;padding:22px}' +
  '.card{max-width:600px;margin:7vh auto;background:#fff;border-radius:22px;padding:30px;box-shadow:0 14px 50px #073f3520}' +
  'h1{font-size:clamp(25px,6vw,36px)}.brand{font-weight:900;letter-spacing:.08em;color:#b98a13}.reference{font-weight:900;font-size:clamp(18px,5vw,29px);overflow-wrap:anywhere;padding:14px;background:#f2f7f2;border-radius:10px}' +
  '.link{display:inline-block;padding:12px 17px;background:#073f35;color:#fff;text-decoration:none;border-radius:10px;margin-top:10px}.reward{color:#1f6a3b;font-weight:bold}p{line-height:1.6}</style>';
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+style+'</head><body><main class="card"><div class="brand">AKTYPINGHUB</div><h1'+(isError?' style="color:#a3382d"':'')+'>'+escape_(title)+'</h1>'+html+'</main></body></html>').setTitle('AKTYPINGHUB | '+title);
}

function requireAdmin_(secret) {
  const stored=PropertiesService.getScriptProperties().getProperty('ADMIN_SECRET');
  if(!stored || stored.length<16) throw new Error('Admin account is not configured securely.');
  if(typeof secret!=='string'||secret!==stored) throw new Error('Access denied.');
}
function adminOrders(secret) {
  requireAdmin_(secret);
  const orders=rows_(ORDER_SHEET);
  return orders.slice().reverse().slice(0,250).map(r=>({
    id:String(r[O.ID]),timestamp:String(r[O.DATE]),phone:String(r[O.PHONE]),name:String(r[O.NAME]),
    service:String(r[O.SERVICE]),copies:Number(r[O.COPIES]),notes:String(r[O.NOTES]),
    discount:Number(r[O.DISCOUNT]),status:String(r[O.STATUS]),referral:String(r[O.REF])
  }));
}
function adminSetStatus(secret, orderId, nextStatus) {
  requireAdmin_(secret);
  const id=text_(orderId,40),status=text_(nextStatus,20);
  if(!STATUS.includes(status)) throw new Error('Invalid status.');
  return lock_(function() {
    const orders=rows_(ORDER_SHEET), idx=orders.findIndex(r=>String(r[O.ID])===id);
    if(idx===-1) throw new Error('Order not found.');
    const current=String(orders[idx][O.STATUS]);
    if(['completed','cancelled'].includes(current)) throw new Error('Completed/cancelled orders cannot be reopened.');
    if(status===current) return 'No change required.';
    const os=sheet_(ORDER_SHEET);
    os.getRange(idx+2,O.STATUS+1).setValue(status);
    os.getRange(idx+2,O.UPDATED+1).setValue(new Date().toISOString());
    if(status==='completed' && orders[idx][O.BY]) {
      const customers=rows_(CUSTOMER_SHEET);
      const newCustomer=customers.find(r=>String(r[C.PHONE])===String(orders[idx][O.PHONE]));
      // Reward only for the referred customer's actual first completed order.
      if(newCustomer && String(newCustomer[C.FIRST])===id) {
        const referrerIdx=customers.findIndex(r=>String(r[C.PHONE])===String(orders[idx][O.BY]));
        if(referrerIdx>=0 && String(customers[referrerIdx][C.EARNED])!=='yes') {
          sheet_(CUSTOMER_SHEET).getRange(referrerIdx+2,C.EARNED+1).setValue('yes');
        }
      }
    }
    return 'Updated '+id+' to '+status+'.';
  });
}
