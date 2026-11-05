# AKTYPINGHUB — GitHub Pages + Google Sheets (no Cloudflare)

This edition retains the green-and-gold mobile homepage, Google-friendly page title and description, interactive 3D business card, services, 2% welcome offer and one-time 5% referral reward.

**Technology:** Your existing GitHub Pages website (free) + **Google Apps Script** (server-side application) + **one private Google Sheet** (orders + customers). There is no Cloudflare Worker, D1 database, WhatsApp, or social-media integration.

**Important:** This bundle contains working source code and was checked with a local simulated test. It is NOT deployed to your Google or GitHub account. You must connect the Apps Script deployment URL before the online form can accept orders. The Google Apps Script deployment could not be live-tested without access to your account.

## How customer orders work

Customer completes the form on your GitHub Pages website. Pressing **Submit** opens an Apps Script confirmation receipt in a new browser tab. The back end validates the fields, uses a lock to avoid simultaneous discount allocations, records everything in your private Google Sheet, and gives a reference ID. Order tracking similarly opens a status page after the customer enters their reference + mobile number.

A separate **private staff dashboard** runs under your Apps Script web-app URL with `?view=admin`. A long admin passphrase is checked **server-side** and is never included in the public site code. Only the owner can safely manage orders with that passphrase.

## Set up — Step 1: Create the Google Sheet

1. Visit https://sheets.google.com while signed in to the Google account that will own your business records.
2. Create a **blank spreadsheet**, for example `AKTYPINGHUB Order Register`.
3. Keep the spreadsheet **Restricted / private**. Do not publish it or enable `Anyone with the link` editing.
4. Open **Extensions > Apps Script**. This creates a script bound to the spreadsheet.

## Step 2: Install the Apps Script files

1. Replace the `Code.gs` contents with the code in `apps-script/Code.gs`.
2. In the Apps Script editor, click **+ > HTML** and name the file **Admin** (exact capitalization). Replace its contents with `apps-script/Admin.html`.
3. Save the Apps Script project. `appsscript.json` in this package is a reference manifest; it's optional to copy for this simple project.
4. Choose `setup` in the editor's function dropdown and click **Run**. Approve the Google authorization prompt. This initializes the `Customers` and `Orders` tabs and saves the spreadsheet's private ID in Script Properties.
5. Under **Project Settings > Script Properties**, click **Add script property**. Set name `ADMIN_SECRET` and value to a **long random passphrase of at least 16 characters** (32+ random characters preferred). Do not paste the passphrase into any public HTML, GitHub repository, or share it with customers.

You can generate your private passphrase on your own device using PowerShell:

```powershell
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($b)
[Convert]::ToBase64String($b)
```

Keep the generated secret in a password manager. Only authorized staff should know it.

## Step 3: Deploy Apps Script web app

1. In Apps Script click **Deploy > New deployment**.
2. Select type **Web app**.
3. Choose **Execute as: Me** (the owner).
4. Choose **Who has access: Anyone** if you want customers to submit without Google login.
5. Click **Deploy**, approve permissions as needed, and copy the URL ending in `/exec`.

Why `Execute as: Me`? Customer requests can be saved in *your* private sheet without customers receiving edit access to it. Access to the public web app does **not** mean access to the private spreadsheet. **Never share the sheet itself.**

Apps Script docs: https://developers.google.com/apps-script/guides/web

## Step 4: Connect your GitHub Pages files

Edit the constant in **both** `index.html` and `admin.html`:

```javascript
const APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```

Replace the placeholder with the actual Google Apps Script web-app URL ending `/exec`, for example:

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

The site intentionally displays **not connected** until you do this; it does not falsely claim that submissions were received.

Upload `index.html`, `admin.html`, and the whole `assets/` folder to the same GitHub Pages repository that hosts your current website. **Do not upload** your real admin secret or make the spreadsheet publicly accessible. The `apps-script/` folder belongs in your private Google Apps Script editor, not on GitHub Pages.

If you later edit `Code.gs` or `Admin.html`, open **Deploy > Manage deployments > Edit** and select a **new version** to publish the changes. Editing the editor alone does not automatically update an existing versioned web-app deployment.

## Step 5: Try the full system

1. On your website submit a new customer A with a real test number, e.g. one you control. A's first request should get **2%**.
2. Open `admin.html` from your site; it links to the private Apps Script dashboard. Enter your `ADMIN_SECRET` and change A's order to `completed` when work is finished.
3. On the website, **Track Request** using A's order reference + phone. A sees a unique referral code and a shareable link.
4. A new customer B follows A's referral link and places a first order. B gets **2%**.
5. Mark B's **first order** completed. A earns a **one-time 5% discount** for A's next eligible order.
6. A's next order should get **5%**, and A's subsequent orders **0%**. One customer cannot redeem a referral reward more than once.

**Discounts never stack.** Referral codes work only for customers submitting their first order, and a referrer's reward becomes available only after the referred customer's first order is marked completed. First-order status is based on the phone number used on the first accepted request; cancelling the request does not automatically restore first-order eligibility.

If you use a test phone number, that phone will now count as an existing customer. Use different numbers for future testing, or clear test data very carefully before taking real orders.

## Security and operating notes

- Google Sheets and Apps Script are Google-hosted services (not social media); **Google processes and stores the data**. This is **not** an offline/on-device-only solution.
- The spreadsheet must remain **private**. Public customers never receive the admin password or sheet URL.
- A long private admin passphrase protects the dashboard. This is a lightweight small-business setup, not an enterprise authentication system.
- Repeated use of the same phone number is detected; however, **phone numbers are not verified with OTP**. Customers using a different or fake number could claim to be new. For stronger prevention, you need verification and/or manual checks before billing.
- Order tracking requires a receipt ID and the corresponding phone, not OTP verification. Treat receipts as private and avoid collecting sensitive identity document contents through the notes field.
- A small web app can attract spam; there is a hidden honeypot and basic input validation, but no comprehensive CAPTCHA or rate-limiting gateway.
- Any percentage is displayed for the order request and must be reviewed against the final eligible invoice. This version does **not** calculate actual prices, collect payments, upload documents or automatically send notifications.
- No email/SMS notification is included. You need to check the admin dashboard or Sheet for new orders.
- Google Apps Script has daily quotas and execution limits. Free-tier usage is suitable for modest traffic, not guaranteed unlimited scale: https://developers.google.com/apps-script/guides/services/quotas
- Add a customer-facing privacy notice, retention period, and contact method before collecting real personal data.

## Files

- `index.html`: public site with SEO + 3D digital card + customer order and tracking forms.
- `admin.html`: public page linking to the private Apps Script admin screen; does **not** store credentials.
- `assets/*.svg`: replacement card artwork and favicon. The original embedded card images from the pasted code were incomplete, so substitute your actual card images if you want an exact match.
- `apps-script/Code.gs`: server-side order validation, spreadsheet updates, referral discounts, tracking and staff operations.
- `apps-script/Admin.html`: password-gated staff interface, running on Apps Script.
- `apps-script/appsscript.json`: optional manifest/time zone reference.

### Google search visibility

The public GitHub Pages site retains the improved `<title>`, description and WebSite structured data. After publishing, use https://search.google.com/search-console to request a recrawl. Google decides when and how your result appears; no change guarantees the first position or automatic opening from a typed search.
