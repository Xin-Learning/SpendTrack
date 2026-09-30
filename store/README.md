# Food store ordering page

A single-page order form for a food store. Customers fill in their details, pick food, choose pickup or delivery and a time, and then tap **Send order on WhatsApp**. WhatsApp opens with the whole order already typed out, so all they do is press send. You confirm the order and arrange payment in that chat.

Every order can also be saved to a Google Sheet in your Google Drive, which adds up your daily sales for you. See [Save orders to Google Sheets](#save-orders-to-google-sheets).

No server, database or monthly fee. It's plain HTML, CSS and JavaScript.

## Set up your store

Everything lives in **`config.js`**:

| Setting | What it does |
| --- | --- |
| `name`, `title`, `logo` | Store name, page heading, emoji or image |
| `whatsapp` | **Your number with country code, digits only**, e.g. `"60123456789"`. While this is empty, the page shows the order message instead of opening WhatsApp, which is handy for testing. |
| `ordersSheetUrl` | Your Google Sheet link for saving orders (see below). Leave empty to skip. |
| `hours`, `closedDates` | Opening hours per day (`null` = closed) and extra days off |
| `slotMinutes`, `leadMinutes`, `daysAhead` | Time slot spacing, how much notice you need, how far ahead people can order |
| `pickup`, `delivery` | Turn each on or off. Set the delivery fee, free-delivery amount and minimum order |
| `payments` | Payment choices shown to customers. Remove them all to skip the question |
| `categories`, `items` | Your menu. Items can have `options` (sizes, add-ons, spice level…), `tags`, and `soldOut: true` |

To use food photos, put them in a folder such as `images/` and set `image: "images/nasi-lemak.jpg"` on the item.

Also change `name` and `short_name` in `manifest.json`. That's the name shown when customers add the page to their home screen.

## Save orders to Google Sheets

Every order goes into a Google Sheet as well as WhatsApp. The sheet has three tabs:

- **Sales**: today, this week and this month at a glance, a day-by-day sales table, today's items to prepare, and your best sellers.
- **Orders**: one row per order with the customer, items, total and a **Status** dropdown (New → Paid → Completed, or Cancelled).
- **Items**: one row per item ordered. The Sales tab uses it for item counts.

Sales are counted by pickup/delivery date and include every order that isn't **Cancelled**. If someone places an order but never sends the WhatsApp message, or cancels, set that order's status to Cancelled and it drops out of your totals. "Waiting to confirm" shows orders still marked New.

### One-time setup (about 5 minutes)

1. Go to <https://sheets.new> to create a blank Google Sheet in your Drive. Name it, e.g. "Store orders".
2. In the sheet, open **Extensions → Apps Script**.
3. Delete what's in the editor, paste in everything from [`google-sheet/Code.gs`](google-sheet/Code.gs), and press **Save** (💾).
4. In the toolbar, pick **setup** from the function list and press **Run**. Google asks you to allow access to your spreadsheet. Choose your account, then **Advanced → Go to (project name) → Allow**. Google shows that warning for any script you write yourself. Back in your sheet, the Sales, Orders and Items tabs now exist.
5. Press **Deploy → New deployment**. Click the gear next to "Select type" and choose **Web app**. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone

   Press **Deploy** and copy the **Web app URL**. It ends in `/exec`.
6. Paste that link into `ordersSheetUrl` in `config.js`:
   ```js
   ordersSheetUrl: "https://script.google.com/macros/s/AKfy.../exec",
   ```
7. To check it: open the link in your browser and you should see "Your order log is running". Then place a test order on your page, and it appears in the Orders tab within a few seconds. Set that test order to **Cancelled** (or delete its rows in Orders and Items) so it doesn't count as a sale.

If you change `Code.gs` later, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy** so the same link keeps working.

**Good to know**
- The script runs in your own Google account, so the sheet stays private. Only you (and anyone you share it with) can see it.
- The link only lets people *add* orders, never read them. Anyone who digs the link out of your page could add fake orders, which is why new orders are marked **New** until you've confirmed them on WhatsApp.
- If a customer's phone is offline when they order, the page keeps the order and sends it to the sheet the next time they open the page.

## Try it on your computer

Run `start-server.bat` in the project folder, then open <http://localhost:5500/store/>.

## Put it online

Any static host works. For example, with **GitHub Pages** (repo → Settings → Pages → deploy from branch), the page is at `https://<your-username>.github.io/<repo>/store/`. Share that link in your Instagram bio or WhatsApp Business profile.
