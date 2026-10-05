import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = "http://localhost:8000";

export default function App() {
  const [metrics, setMetrics] = useState({
    total_requests: 0, successful_purchases: 0, failed_payments: 0,
    duplicate_requests: 0, oversell_attempts: 0, current_stock: 100, total_stock: 100,
  });
  const [orders, setOrders] = useState([]);
  const [product, setProduct] = useState(null);
  const [buying, setBuying] = useState(false);
  const [toast, setToast] = useState(null);
  const [online, setOnline] = useState(null);
  const [feed, setFeed] = useState([]);
  const [saleEnded, setSaleEnded] = useState(false);
  const feedId = useRef(0);
  const toastTimer = useRef(null);

  // countdown 10 min
  const [timeLeft, setTimeLeft] = useState(600);
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { setSaleEnded(true); clearInterval(t); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  const poll = async () => {
    try {
      const [p, m, o] = await Promise.all([
        fetch(`${API}/product/1`).then(r => r.json()),
        fetch(`${API}/metrics`).then(r => r.json()),
        fetch(`${API}/orders`).then(r => r.json()),
      ]);
      setProduct(p); setMetrics(m); setOrders(o); setOnline(true);
    } catch { setOnline(false); }
  };

  useEffect(() => { poll(); const t = setInterval(poll, 2000); return () => clearInterval(t); }, []);

  const toast$ = (type, msg) => {
    clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const addFeed = (type, msg) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setFeed(p => [{ id: ++feedId.current, type, msg, time }, ...p.slice(0, 49)]);
  };

  const handleBuy = async () => {
    if (buying || saleEnded) return;
    setBuying(true);
    const key = crypto.randomUUID();
    try {
      const res = await fetch(`${API}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: 1, idempotency_key: key }),
      });
      const data = await res.json();
      if (res.ok) {
        toast$("success", `✅ Order confirmed! #${data.order_id?.slice(0, 8)}`);
        addFeed("success", `Order confirmed — #${data.order_id?.slice(0, 8)}`);
      } else {
        toast$("error", `❌ ${data.detail}`);
        addFeed("error", data.detail);
      }
    } catch {
      toast$("error", "❌ Backend unreachable");
      addFeed("warn", "Backend unreachable");
    } finally {
      setBuying(false);
      poll();
    }
  };

  const handleReset = async () => {
    await fetch(`${API}/reset`, { method: "POST" }).catch(() => {});
    setFeed([]);
    setSaleEnded(false);
    setTimeLeft(600);
    toast$("info", "🔄 Sale reset");
    addFeed("info", "Sale reset by admin");
    poll();
  };

  const stock = metrics.current_stock ?? 0;
  const total = metrics.total_stock ?? 100;
  const pct = Math.max(0, Math.min(100, Math.round((stock / total) * 100)));
  const sold = total - stock;
  const urgency = pct <= 10 ? "crit" : pct <= 35 ? "low" : "ok";
  const successRate = metrics.total_requests > 0
    ? ((metrics.successful_purchases / metrics.total_requests) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="app">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* HEADER */}
      <header className="hdr">
        <div className="hdr-brand">
          <span className="logo">⚡ SALESTORM</span>
          <span className="pill pill-live">LIVE</span>
        </div>
        <div className="hdr-timer">
          <span className="timer-lbl">ENDS IN</span>
          <span className={`timer-val ${timeLeft < 60 ? "timer-urgent" : ""}`}>{mm}:{ss}</span>
        </div>
        <div className="hdr-actions">
          <span className={`status-dot ${online === true ? "up" : online === false ? "down" : "idle"}`}>
            {online === true ? "API live" : online === false ? "API offline" : "connecting…"}
          </span>
          <button className="btn-sm" onClick={handleReset}>↺ Reset</button>
        </div>
      </header>

      {online === false && (
        <div className="offline-bar">
          ⚠️ Backend is offline — run <code>uvicorn main:app --reload</code> in the backend folder
        </div>
      )}

      <div className="layout">
        {/* LEFT */}
        <div className="left">

          {/* Product card */}
          <div className="product-card">
            <div className="product-glow" />
            <div className="product-left">
              <div className="product-emoji">👕</div>
            </div>
            <div className="product-right">
              <span className="product-tag">LIMITED DROP</span>
              <h1 className="product-name">{product?.name ?? "SALESTORM Hoodie"}</h1>
              <div className="product-pricing">
                <span className="price-main">$29.99</span>
                <span className="price-old">$79.99</span>
                <span className="price-badge">63% OFF</span>
              </div>
              <div className="product-meta">
                <span>🚚 Free shipping</span>
                <span>🔒 Secure checkout</span>
              </div>
            </div>
          </div>

          {/* Stock bar */}
          <div className="stock-card">
            <div className="stock-top">
              <span className={`stock-label lbl-${urgency}`}>
                {urgency === "crit" ? "🔥 Almost gone!" : urgency === "low" ? "⚠️ Low stock" : "✅ In stock"}
              </span>
              <span className="stock-num">{stock} / {total} left</span>
            </div>
            <div className="bar-track">
              <div className={`bar-fill fill-${urgency}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="stock-bottom">
              <span>{sold} sold</span>
              <span>{pct}% remaining</span>
            </div>
          </div>

          {/* BUY button */}
          <button
            className={`btn-buy ${buying ? "buying" : ""} ${stock === 0 || saleEnded ? "soldout" : ""}`}
            onClick={handleBuy}
            disabled={buying || stock === 0 || saleEnded}
          >
            {buying ? <><span className="spin" />Processing payment…</>
              : stock === 0 ? "😔 SOLD OUT"
              : saleEnded ? "⏰ SALE ENDED"
              : "⚡ BUY NOW — $29.99"}
          </button>

          {/* Metrics grid */}
          <div className="metrics-grid">
            <Tile icon="📨" label="Total Requests"  value={metrics.total_requests}        color="var(--blue)" />
            <Tile icon="✅" label="Purchased"        value={metrics.successful_purchases}  color="var(--green)" />
            <Tile icon="💳" label="Failed Payments"  value={metrics.failed_payments}       color="var(--red)" />
            <Tile icon="♻️" label="Duplicates"       value={metrics.duplicate_requests}    color="var(--yellow)" />
            <Tile icon="🚫" label="Oversell Blocked" value={metrics.oversell_attempts}     color="var(--pink)" />
            <Tile icon="📈" label="Success Rate"     value={`${successRate}%`}             color="var(--purple)" raw />
          </div>
        </div>

        {/* RIGHT */}
        <div className="right">
          {/* Orders table */}
          <div className="panel">
            <div className="panel-hdr">
              <span>🧾 Recent Orders</span>
              <span className="pill pill-count">{orders.length}</span>
            </div>
            <div className="orders-wrap">
              {orders.length === 0
                ? <p className="empty">No orders yet — hit BUY NOW</p>
                : <table className="tbl">
                    <thead><tr><th>Order</th><th>Payment</th><th>Time</th></tr></thead>
                    <tbody>
                      {orders.map(o => (
                        <tr key={o.id}>
                          <td className="mono">#{o.id.slice(0, 8)}</td>
                          <td className="mono">{o.payment_id.slice(0, 8)}</td>
                          <td className="muted">{new Date(o.created_at * 1000).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>

          {/* Activity feed */}
          <div className="panel feed-panel">
            <div className="panel-hdr">
              <span>⚡ Activity Feed</span>
              <span className="pill pill-count">{feed.length}</span>
            </div>
            <div className="feed-wrap">
              {feed.length === 0
                ? <p className="empty">Waiting for activity…</p>
                : feed.map(f => (
                    <div key={f.id} className={`feed-row feed-${f.type}`}>
                      <span className="feed-dot" />
                      <span className="feed-msg">{f.msg}</span>
                      <span className="feed-time">{f.time}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, color, raw }) {
  return (
    <div className="tile" style={{ "--c": color }}>
      <div className="tile-top-bar" />
      <span className="tile-icon">{icon}</span>
      <span className="tile-val">{raw ? value : Number(value ?? 0).toLocaleString()}</span>
      <span className="tile-lbl">{label}</span>
    </div>
  );
}
