export { isDemoMode } from "@/lib/demo-mode";
import type {
  AgentDetail,
  AgentSummary,
  FailureReport,
  WebhookDelivery,
} from "@/types/agents";
import type { Document } from "@/types/documents";
import type { AuditData } from "@/lib/queries/audit";

const demoAgentId = "demo-agent-invoices";
const secondaryAgentId = "demo-agent-subcontractors";

const fieldSchema = [
  { name: "vendor", type: "exact", required: true },
  { name: "invoice_number", type: "exact", required: true },
  { name: "issued_date", type: "date", required: true },
  { name: "total", type: "numeric", required: true },
  { name: "payment_terms", type: "fuzzy", required: false },
];

const perFieldScores = {
  vendor: { passed: 12, total: 12, accuracy: 1, scorer: "exact" },
  invoice_number: { passed: 11, total: 12, accuracy: 0.917, scorer: "exact" },
  issued_date: { passed: 12, total: 12, accuracy: 1, scorer: "date" },
  total: { passed: 12, total: 12, accuracy: 1, scorer: "numeric" },
  payment_terms: { passed: 10, total: 12, accuracy: 0.833, scorer: "fuzzy" },
};

export const demoAgents: AgentSummary[] = [
  {
    id: demoAgentId,
    name: "Invoice extraction",
    status: "active",
    active_bundle_version: 3,
    accuracy_summary: {
      overall: 0.95,
      per_field: {
        vendor: 1,
        invoice_number: 0.917,
        issued_date: 1,
        total: 1,
        payment_terms: 0.833,
      },
    },
    created_at: "2026-05-20T09:30:00.000Z",
    sample_count: 36,
  },
  {
    id: secondaryAgentId,
    name: "Subcontractor pack intake",
    status: "trained",
    active_bundle_version: 1,
    accuracy_summary: {
      overall: 0.887,
      per_field: {
        company_name: 0.95,
        abn: 0.9,
        insurance_expiry: 0.8,
        license_number: 0.9,
      },
    },
    created_at: "2026-05-22T02:15:00.000Z",
    sample_count: 18,
  },
];

export const demoDocuments: Document[] = [
  {
    id: "demo-doc-001",
    filename: "acme-invoice-1048.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 428_320,
    status: "extracted",
    uploaded_at: "2026-05-28T05:05:00.000Z",
    agent_id: demoAgentId,
    agent_name: "Invoice extraction",
  },
  {
    id: "demo-doc-002",
    filename: "northline-progress-claim.csv",
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    file_size_bytes: 112_904,
    status: "needs_review",
    uploaded_at: "2026-05-28T04:42:00.000Z",
    agent_id: demoAgentId,
    agent_name: "Invoice extraction",
  },
  {
    id: "demo-doc-003",
    filename: "buildsafe-compliance-pack.pdf",
    mime_type: "application/pdf",
    file_size_bytes: 1_845_211,
    status: "processing",
    uploaded_at: "2026-05-28T04:20:00.000Z",
    agent_id: secondaryAgentId,
    agent_name: "Subcontractor pack intake",
  },
];

export const demoAgentDetails: Record<string, AgentDetail> = {
  [demoAgentId]: {
    ...demoAgents[0],
    webhook_url: "https://example.customer.dev/trestle/invoices",
    has_webhook_secret: true,
    inbound_email_token: "demo-invoice",
    has_api_key: true,
    field_schema: fieldSchema,
    pending_review_count: 1,
    bundles: [
      {
        id: "demo-bundle-3",
        version: 3,
        field_schema: fieldSchema,
        created_at: "2026-05-27T23:20:00.000Z",
      },
      {
        id: "demo-bundle-2",
        version: 2,
        field_schema: fieldSchema.slice(0, 4),
        created_at: "2026-05-26T00:10:00.000Z",
      },
    ],
    eval_runs: [
      {
        id: "demo-run-held-out",
        bundle_version: 3,
        phase: "held_out",
        status: "completed",
        overall_accuracy: 0.95,
        per_field_scores: perFieldScores,
        sample_count: 12,
        error: null,
        started_at: "2026-05-27T23:30:00.000Z",
        completed_at: "2026-05-27T23:33:00.000Z",
      },
      {
        id: "demo-run-train",
        bundle_version: 3,
        phase: "train",
        status: "completed",
        overall_accuracy: 0.972,
        per_field_scores: perFieldScores,
        sample_count: 24,
        error: null,
        started_at: "2026-05-27T23:21:00.000Z",
        completed_at: "2026-05-27T23:28:00.000Z",
      },
    ],
    review_items: [
      {
        id: "demo-review-001",
        document_id: "demo-doc-002",
        reason: "Lowest calibrated confidence was below delivery threshold.",
        min_confidence: 0.62,
        status: "pending",
        created_at: "2026-05-28T04:43:00.000Z",
        filename: "northline-progress-claim.csv",
      },
    ],
    audit_links: [
      {
        id: "demo-audit-link",
        token: "demo-invoice-audit",
        prospect_company: "Acme Construction",
        prospect_email: "ops@example.com",
        expires_at: "2026-06-28T00:00:00.000Z",
        revoked_at: null,
        view_count: 3,
        created_at: "2026-05-28T00:00:00.000Z",
        eval_run_id: "demo-run-held-out",
      },
    ],
    destinations: [
      {
        id: "demo-destination-webhook",
        agent_id: demoAgentId,
        kind: "webhook",
        label: "Invoice intake webhook",
        config: { url: "https://example.customer.dev/trestle/invoices" },
        enabled: true,
        created_at: "2026-05-27T23:00:00.000Z",
        updated_at: "2026-05-27T23:00:00.000Z",
      },
    ],
    billing: {
      plan: "starter",
      plan_status: "active",
      docs_processed_current_period: 184,
      current_period_ends_at: "2026-06-20T00:00:00.000Z",
    },
  },
  [secondaryAgentId]: {
    ...demoAgents[1],
    webhook_url: null,
    has_webhook_secret: false,
    inbound_email_token: "demo-compliance",
    has_api_key: true,
    field_schema: [
      { name: "company_name", type: "exact", required: true },
      { name: "abn", type: "exact", required: true },
      { name: "insurance_expiry", type: "date", required: true },
      { name: "license_number", type: "exact", required: false },
    ],
    pending_review_count: 0,
    bundles: [
      {
        id: "demo-compliance-bundle-1",
        version: 1,
        field_schema: [
          { name: "company_name", type: "exact", required: true },
          { name: "abn", type: "exact", required: true },
          { name: "insurance_expiry", type: "date", required: true },
          { name: "license_number", type: "exact", required: false },
        ],
        created_at: "2026-05-24T00:00:00.000Z",
      },
    ],
    eval_runs: [
      {
        id: "demo-compliance-held-out",
        bundle_version: 1,
        phase: "held_out",
        status: "completed",
        overall_accuracy: 0.887,
        per_field_scores: {
          company_name: { passed: 10, total: 10, accuracy: 1, scorer: "exact" },
          abn: { passed: 9, total: 10, accuracy: 0.9, scorer: "exact" },
          insurance_expiry: { passed: 8, total: 10, accuracy: 0.8, scorer: "date" },
          license_number: { passed: 8, total: 10, accuracy: 0.8, scorer: "exact" },
        },
        sample_count: 10,
        error: null,
        started_at: "2026-05-24T00:10:00.000Z",
        completed_at: "2026-05-24T00:13:00.000Z",
      },
    ],
    review_items: [],
    audit_links: [],
    destinations: [],
    billing: {
      plan: "free",
      plan_status: "active",
      docs_processed_current_period: 7,
      current_period_ends_at: "2026-06-24T00:00:00.000Z",
    },
  },
};

export const demoFailures: Record<string, FailureReport> = {
  [demoAgentId]: {
    runId: "demo-run-held-out",
    phase: "held_out",
    overallAccuracy: 0.95,
    perField: perFieldScores,
    fields: ["vendor", "invoice_number", "issued_date", "total", "payment_terms"],
    rows: [
      {
        sampleId: "sample-001",
        filename: "acme-invoice-1048.pdf",
        perFieldPassed: {
          vendor: true,
          invoice_number: true,
          issued_date: true,
          total: true,
          payment_terms: true,
        },
        expected: {
          vendor: "Acme Supplies",
          invoice_number: "INV-1048",
          issued_date: "2026-05-12",
          total: "$4,820.00",
          payment_terms: "14 days from invoice date",
        },
        output: {
          vendor: "Acme Supplies",
          invoice_number: "INV-1048",
          issued_date: "12 May 2026",
          total: 4820,
          payment_terms: "payment due within 14 days",
        },
      },
      {
        sampleId: "sample-002",
        filename: "northline-progress-claim.csv",
        perFieldPassed: {
          vendor: true,
          invoice_number: false,
          issued_date: true,
          total: true,
          payment_terms: false,
        },
        expected: {
          vendor: "Northline Civil",
          invoice_number: "PC-2217",
          issued_date: "2026-05-18",
          total: "$18,450.70",
          payment_terms: "30 days end of month",
        },
        output: {
          vendor: "Northline Civil",
          invoice_number: "PC-2271",
          issued_date: "18 May 2026",
          total: 18450.7,
          payment_terms: "30 days",
        },
      },
    ],
  },
};

export const demoDeliveries: Record<string, WebhookDelivery[]> = {
  [demoAgentId]: [
    {
      id: "demo-delivery-001",
      document_id: "demo-doc-001",
      url: "https://example.customer.dev/trestle/invoices",
      ok: true,
      status_code: 200,
      attempts: 1,
      error: null,
      created_at: "2026-05-28T05:06:00.000Z",
    },
    {
      id: "demo-delivery-002",
      document_id: "demo-doc-002",
      url: "https://example.customer.dev/trestle/invoices",
      ok: false,
      status_code: null,
      attempts: 0,
      error: "Held for review before delivery",
      created_at: "2026-05-28T04:43:00.000Z",
    },
  ],
};

export const demoAuditData: Record<string, AuditData> = {
  "demo-invoice-audit": {
    link: {
      id: "demo-audit-link",
      user_id: "demo-user",
      agent_id: demoAgentId,
      eval_run_id: "demo-run-held-out",
      token: "demo-invoice-audit",
      prospect_name: "Jordan Lee",
      prospect_company: "Acme Construction",
      prospect_email: "ops@example.com",
      expires_at: "2026-06-28T00:00:00.000Z",
      revoked_at: null,
      view_count: 3,
      last_viewed_at: "2026-05-28T06:30:00.000Z",
      created_at: "2026-05-28T00:00:00.000Z",
    },
    agent: {
      id: demoAgentId,
      name: "Invoice extraction",
      created_at: "2026-05-20T09:30:00.000Z",
    },
    eval_run: {
      id: "demo-run-held-out",
      bundle_version: 3,
      phase: "held_out",
      status: "complete",
      overall_accuracy: 0.95,
      per_field_scores: perFieldScores,
      sample_count: 12,
      error: null,
      started_at: "2026-05-27T23:30:00.000Z",
      completed_at: "2026-05-27T23:33:00.000Z",
    },
    field_schema: fieldSchema,
    samples: [
      {
        id: "sample-001",
        filename: "acme-invoice-1048.pdf",
        expected_output: {
          vendor: "Acme Supplies",
          invoice_number: "INV-1048",
          issued_date: "2026-05-12",
          total: "$4,820.00",
          payment_terms: "14 days from invoice date",
        },
        predicted_output: {
          vendor: "Acme Supplies",
          invoice_number: "INV-1048",
          issued_date: "12 May 2026",
          total: 4820,
          payment_terms: "payment due within 14 days",
        },
        per_field_passed: {
          vendor: true,
          invoice_number: true,
          issued_date: true,
          total: true,
          payment_terms: true,
        },
        confidence_scores: {
          vendor: 0.98,
          invoice_number: 0.96,
          issued_date: 0.94,
          total: 0.97,
          payment_terms: 0.88,
        },
      },
      {
        id: "sample-002",
        filename: "northline-progress-claim.csv",
        expected_output: {
          vendor: "Northline Civil",
          invoice_number: "PC-2217",
          issued_date: "2026-05-18",
          total: "$18,450.70",
          payment_terms: "30 days end of month",
        },
        predicted_output: {
          vendor: "Northline Civil",
          invoice_number: "PC-2271",
          issued_date: "18 May 2026",
          total: 18450.7,
          payment_terms: "30 days",
        },
        per_field_passed: {
          vendor: true,
          invoice_number: false,
          issued_date: true,
          total: true,
          payment_terms: false,
        },
        confidence_scores: {
          vendor: 0.92,
          invoice_number: 0.61,
          issued_date: 0.9,
          total: 0.94,
          payment_terms: 0.58,
        },
      },
    ],
  },
};
