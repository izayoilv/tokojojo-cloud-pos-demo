CREATE VIEW v_stock_balances AS
SELECT
  product_id,
  location,
  SUM(qty_change)::numeric(12,3) AS qty,
  (SUM(qty_change) < 0) AS is_negative
FROM stock_movements
GROUP BY product_id, location;
--> statement-breakpoint

CREATE VIEW v_sale_balances AS
SELECT
  s.id AS sale_id,
  s.total_amount,
  COALESCE(r.total_refund, 0)::bigint AS total_refund,
  COALESCE(p.paid, 0)::bigint AS paid,
  COALESCE(r.cash_refund, 0)::bigint AS cash_refunded,
  GREATEST(
    s.total_amount - COALESCE(r.total_refund, 0)
      - (COALESCE(p.paid, 0) - COALESCE(r.cash_refund, 0)),
    0
  )::bigint AS outstanding,
  GREATEST(
    (COALESCE(p.paid, 0) - COALESCE(r.cash_refund, 0))
      - (s.total_amount - COALESCE(r.total_refund, 0)),
    0
  )::bigint AS refund_due,
  CASE
    WHEN s.total_amount - COALESCE(r.total_refund, 0)
      <= COALESCE(p.paid, 0) - COALESCE(r.cash_refund, 0)
      THEN 'PAID'
    WHEN COALESCE(p.paid, 0) - COALESCE(r.cash_refund, 0) > 0
      THEN 'PARTIAL'
    ELSE 'UNPAID'
  END AS payment_status
FROM sales s
LEFT JOIN (
  SELECT sale_id, SUM(amount) AS paid
  FROM sale_payments
  GROUP BY sale_id
) p ON p.sale_id = s.id
LEFT JOIN (
  SELECT sale_id, SUM(total_refund) AS total_refund, SUM(cash_refund) AS cash_refund
  FROM sale_returns
  GROUP BY sale_id
) r ON r.sale_id = s.id
WHERE s.status = 'COMPLETED';
--> statement-breakpoint

CREATE VIEW v_purchase_balances AS
SELECT
  p.id AS purchase_id,
  p.total_amount,
  COALESCE(pp.paid, 0)::bigint AS paid,
  GREATEST(p.total_amount - COALESCE(pp.paid, 0), 0)::bigint AS outstanding,
  CASE
    WHEN COALESCE(pp.paid, 0) >= p.total_amount THEN 'PAID'
    WHEN COALESCE(pp.paid, 0) > 0 THEN 'PARTIAL'
    ELSE 'UNPAID'
  END AS payment_status
FROM purchases p
LEFT JOIN (
  SELECT purchase_id, SUM(amount) AS paid
  FROM purchase_payments
  GROUP BY purchase_id
) pp ON pp.purchase_id = p.id
WHERE p.status = 'OPEN';
--> statement-breakpoint

CREATE FUNCTION stock_movements_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'stock_movements is append-only; insert a corrective movement instead';
END;
$$;
--> statement-breakpoint

CREATE TRIGGER stock_movements_no_update_delete
BEFORE UPDATE OR DELETE ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION stock_movements_append_only();
