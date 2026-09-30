# Food store ordering page

A single-page order form for a food store. Customers fill in their details, pick food, choose pickup or delivery and a time, and then tap **Send order on WhatsApp**. WhatsApp opens with the whole order already typed out, so all they do is press send. You confirm the order and arrange payment in that chat.

No server, database or monthly fee. It's plain HTML, CSS and JavaScript.

## Set up your store

Everything lives in **`config.js`**:

| Setting | What it does |
| --- | --- |
| `name`, `title`, `logo` | Store name, page heading, emoji or image |
| `whatsapp` | **Your number with country code, digits only**, e.g. `"60123456789"`. While this is empty, the page shows the order message instead of opening WhatsApp, which is handy for testing. |
| `hours`, `closedDates` | Opening hours per day (`null` = closed) and extra days off |
| `slotMinutes`, `leadMinutes`, `daysAhead` | Time slot spacing, how much notice you need, how far ahead people can order |
| `pickup`, `delivery` | Turn each on or off. Set the delivery fee, free-delivery amount and minimum order |
| `payments` | Payment choices shown to customers. Remove them all to skip the question |
| `categories`, `items` | Your menu. Items can have `options` (sizes, add-ons, spice level…), `tags`, and `soldOut: true` |

To use food photos, put them in a folder such as `images/` and set `image: "images/nasi-lemak.jpg"` on the item.

Also change `name` and `short_name` in `manifest.json`. That's the name shown when customers add the page to their home screen.

## Try it on your computer

Run `start-server.bat` in the project folder, then open <http://localhost:5500/store/>.

## Put it online

Any static host works. For example, with **GitHub Pages** (repo → Settings → Pages → deploy from branch), the page is at `https://<your-username>.github.io/<repo>/store/`. Share that link in your Instagram bio or WhatsApp Business profile.
