# Hyppin — The Complete Business Cycle

> A strategic, end-to-end map of how value flows between Buyers, Sellers, Delivery Partners, Hyppin Executives, the Admin Panel, and Support — built so anyone can understand Hyppin in 60 seconds and any new team member can ship in week one.

---

## 1. Executive Snapshot

Hyppin is a **hyperlocal commerce platform** that connects **Buyers** with **physically-verified Sellers** through three integrated apps — **Buyer App**, **Seller App**, and **Executive/Admin App** — supported by a **Delivery Partner** network and a **Support layer**.

Hyppin's edge is **trust by design**:
- Every seller is **physically onboarded** by a Hyppin executive.
- Every order has a **60-second acceptance SLA** enforced by AI calling.
- Every pickup is **OTP + photo-proof** secured.
- Every return is governed by a **7-day, rating-backed resolution engine**.

---

## 2. The Hyppin Cycle at a Glance

```mermaid
flowchart LR
    A[Seller Onboarding] --> B[Store Goes Live]
    B --> C[Buyer Discovers Product]
    C --> D[Buyer Places Order]
    D --> E[Seller Accepts and Packs]
    E --> F[Delivery Partner Pickup]
    F --> G[Delivered to Buyer]
    G --> H{Return within 7 days?}
    H -->|No| I[Cycle Complete]
    H -->|Yes| J[Return Flow]
    J --> K{Resolution}
    K -->|Approved| L[Refund to Buyer]
    K -->|Rejected| M[Support Ticket]
    M --> N[Verdict + Rating Impact]
    L --> I
    N --> I
    I --> C
```

---

## 3. Phase 1 — Seller Onboarding & Activation

> "We don't just verify documents. We walk into the shop."

```mermaid
flowchart TD
    S1[Seller signs up via Seller domain] --> S2[Fill: Basic / Business / Bank / Signature]
    S2 --> S3[Review and Submit -> Order ID generated]
    S3 --> S4[Admin Panel verifies submission]
    S4 --> S5[Hyppin Executive scheduled<br/>confirms date, time, address by call]
    S5 --> S6[Executive carries 23 starter bags to store]
    S6 --> S7{Physical Quality Check at Store}
    S7 --> S7a[Laptop / Wi-Fi / Network]
    S7 --> S7b[Product quality and pricing]
    S7 --> S7c[GST / Bank / Store docs vs submission]
    S7a --> S8[Bank verified via 1 Rupee ping]
    S7b --> S8
    S7c --> S8
    S8 --> S9[Executive confirms via Executive App]
    S9 --> S10[Admin gives final approval]
    S10 --> S11[Seller sets 4 or 6-digit PIN<br/>Executive does NOT see PIN]
    S11 --> S12[Settings walkthrough:<br/>Store Profile / Business / Payment / Notifications]
    S12 --> S13[Demo: Inventory / Orders / Returns /<br/>Billing / Barcode / Packing / Photo upload]
    S13 --> S14[Add first 5 products together]
    S14 --> S15[Toggle Store ONLINE]
    S15 --> S16[Executive submits final confirmation in app]
```

**Why this matters:** the PIN-lock replaces OTP friction, the physical visit eliminates fake sellers, and the 5-product live-add ensures the seller can actually operate before going live.

---

## 4. Phase 2 — Buyer Discovery → Order Placement

```mermaid
flowchart TD
    B1[Open Buyer App] --> B2[Discover product]
    B2 --> B3[Product Detail Page<br/>size / color / brand / shop / reviews /<br/>delivery time / price / offers / return policy]
    B3 --> B4[Add to Cart]
    B4 --> B5[Cart: apply coupons and add-ons]
    B5 --> B6[Enter or add Delivery Address]
    B6 --> B7[Review order + Bill Summary / Invoice]
    B7 --> B8{Payment Method}
    B8 -->|UPI / GPay| B9[Pay]
    B8 -->|Credit / Debit Card| B9
    B8 -->|COD| B9
    B9 --> B10[Order Placed -> 'Yet to be confirmed by Seller']
    B10 --> B11[Notification fires to Seller]
```

**Buyer-side status ladder:**
`Order Placed` → `Confirmed by Seller` → `Yet to be Shipped` → `Shipped / Out for Delivery` → `Delivered` → *(optional)* `Returned`

---

## 5. Phase 3 — Seller Order Acceptance & Packing

> The 60-second acceptance window is Hyppin's promise to the buyer.

```mermaid
flowchart TD
    O1[Seller receives notification] --> O2{Acceptance window: 60s}
    O2 --> R1[0-30s: Notification ring]
    R1 --> R2[2s gap]
    R2 --> R3[32-62s: 2nd notification ring]
    R3 --> R4[2s gap]
    R4 --> R5[64-72s: AI call attempt 1 - 8s]
    R5 --> R6[2s gap]
    R6 --> R7[74-82s: AI call attempt 2 - 8s]
    R7 --> R8[2s gap]
    R8 --> R9[84-92s: AI call attempt 3 - 8s]
    R9 --> O3{Accepted?}
    O3 -->|No| O4[Auto-Cancel<br/>Buyer sees: Out of Stock / Other reason<br/>Seller rate card impacted]
    O3 -->|Yes| O5[Status -> Confirmed by Seller]
    O5 --> O6[Seller scans QR / barcode of product]
    O6 --> O7[Upload Front + Back photo]
    O7 --> O8[Pack within 5 min<br/>backend buffer: 10 min]
    O8 --> O9[Status -> Ready for Pickup]
```

---

## 6. Phase 4 — Delivery Handover

```mermaid
flowchart TD
    D1[Delivery Partner arrives at store] --> D2[Partner shares or enters OTP]
    D2 --> D3[Seller hands over parcel<br/>photo proof captured]
    D3 --> D4[Status -> Shipped / Out for Delivery]
    D4 --> D5{Buyer available?}
    D5 -->|Yes| D6[Delivered -> Buyer receives]
    D5 -->|No response| D7[Parcel returned to Seller]
    D7 --> D8[Seller inspects parcel]
    D8 --> D9{Product safe and undamaged?}
    D9 -->|Yes| D10[Re-add to inventory via Re-edit button]
    D9 -->|No| D11[Raise damage ticket -> Support]
```

---

## 7. Phase 5 — Returns & Refund Resolution (The Trust Engine)

```mermaid
flowchart TD
    RT1[Buyer opens past order in Buyer App] --> RT2{Within 7-day window?}
    RT2 -->|No| RT3[Return button hidden<br/>Buyer notified: return period over]
    RT2 -->|Yes| RT4[Buyer selects reason and submits return]
    RT4 --> RT5[Return request sent to Seller]
    RT5 --> RT6[Delivery Partner picks parcel<br/>Order ID label - bulk multi-pickup]
    RT6 --> RT7[Parcel reaches Seller in batch]
    RT7 --> RT8[Seller inspects: damage / swap / scam check]
    RT8 --> RT9{Seller Decision}
    RT9 -->|Approve Refund| RT10[Refund initiated<br/>Buyer notified<br/>Refund credited within 7 days]
    RT9 -->|Reject| RT11[Seller uploads photo proof + reason]
    RT11 --> RT12[Support ticket auto-created]
    RT12 --> RT13[Support contacts Buyer + Seller]
    RT13 --> RT14{Verdict}
    RT14 -->|Buyer at fault| RT15[Refund to Seller<br/>Delivery fine on Buyer<br/>Buyer rating drops]
    RT14 -->|Seller at fault| RT16[Refund to Buyer<br/>Delivery fine on Seller<br/>Seller rating drops<br/>Order stays in Rejected tab]
```

---

## 8. Supporting Loop — Packaging Bag Refill

```mermaid
flowchart LR
    P1[Low-stock alert on bags] --> P2[Seller clicks 'Buy More Bags']
    P2 --> P3[Enter quantity and size, pay]
    P3 --> P4[Request hits Admin Panel]
    P4 --> P5[Admin approves]
    P5 --> P6[Executive QCs bags]
    P6 --> P7[Executive delivers to seller<br/>marks status -> Delivered]
    P7 --> P8[Seller bag inventory auto-updates]
```

---

## 9. The Trust & Safety Decision Matrix

| Scenario | Refund goes to | Rating impact | Delivery fine |
|---|---|---|---|
| Seller approves return | **Buyer** | None | None |
| Seller rejects → Buyer at fault (false claim, used item, scam) | **Seller** | Buyer ↓ | Buyer pays |
| Seller rejects → Seller at fault (damage, swap, low quality) | **Buyer** | Seller ↓ | Seller pays |
| Buyer not available at delivery | N/A (parcel returns) | Buyer ↓ (repeat offences) | Buyer pays |
| Seller misses 60s acceptance | N/A (auto-cancel) | Seller ↓ | None |

---

## 10. Return Eligibility Triggers

A buyer can request a return for any of these reasons (within the 7-day window for Fashion / Footwear / Watches):

1. No response from buyer when the delivery partner reaches the address
2. Damage to the product
3. Size or color issue
4. Quality issue

---

## 11. Roles at a Glance

| Actor | Core Responsibilities |
|---|---|
| **Buyer** | Discover, order, pay, receive, optionally return within 7 days |
| **Seller** | Accept orders in ≤60s, scan + photograph, pack ≤5min, manage inventory, handle returns, refill bags |
| **Delivery Partner** | OTP-based pickup, photo proof, deliver, multi-batch return pickup |
| **Hyppin Executive** | Onboard sellers, physical QC, demo, bag delivery, app-based confirmations |
| **Admin Panel** | Verify onboarding, approve activations, approve bag refills, oversee tickets |
| **Support Team** | Mediate disputes, raise IT tickets, decide refund verdicts |

---

## 12. The One-Line Pitch

> **Hyppin verifies sellers physically, lets buyers shop hyperlocal in seconds, enforces a 60-second order acceptance, OTP-secured pickup, photo-proof packing, and a rating-backed 7-day return engine — so trust is built into every step of the cycle.**

---

## 13. The Hyppin Flywheel — Why It Compounds

```mermaid
flowchart LR
    F1[Physically verified Sellers] --> F2[Higher Buyer Trust]
    F2 --> F3[More Orders]
    F3 --> F4[Stronger Seller Earnings]
    F4 --> F5[Better Inventory and Quality]
    F5 --> F6[Lower Returns + Higher Ratings]
    F6 --> F7[More Buyer Loyalty]
    F7 --> F3
    F6 --> F1
```

Every loop in this document feeds the flywheel: faster onboarding adds verified sellers, the 60-second SLA drives buyer trust, the photo-proof + OTP system reduces disputes, and the rating-backed resolution engine punishes bad actors and rewards good ones — making the next cycle smoother than the last.
