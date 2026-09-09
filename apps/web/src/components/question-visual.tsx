"use client";

import { useMemo } from "react";
import type { QuestionDTO } from "@/lib/api";

interface QuestionVisualProps {
  question: QuestionDTO;
}

type VisualCategory =
  | "attention"
  | "backprop"
  | "statistics"
  | "optimization"
  | "distributed"
  | "classification"
  | "nlp"
  | "general";

export function QuestionVisual({ question }: QuestionVisualProps) {
  const category = useMemo<VisualCategory>(() => {
    const text = `${question.topic} ${question.subtopic ?? ""} ${question.prompt}`.toLowerCase();

    if (
      text.includes("attention") ||
      text.includes("transformer") ||
      text.includes("qkv") ||
      text.includes("query") ||
      text.includes("head") ||
      text.includes("llama") ||
      text.includes("seq_len")
    ) {
      return "attention";
    }

    if (
      text.includes("gradient") ||
      text.includes("backprop") ||
      text.includes("backward") ||
      text.includes("derivative") ||
      text.includes("chain rule") ||
      text.includes("activation")
    ) {
      return "backprop";
    }

    if (
      text.includes("statistic") ||
      text.includes("probability") ||
      text.includes("normal distribution") ||
      text.includes("deviation") ||
      text.includes("confidence interval") ||
      text.includes("p-value") ||
      text.includes("bayes") ||
      text.includes("variance") ||
      text.includes("median")
    ) {
      return "statistics";
    }

    if (
      text.includes("optimizer") ||
      text.includes("adam") ||
      text.includes("learning rate") ||
      text.includes("loss") ||
      text.includes("regularization") ||
      text.includes("l2") ||
      text.includes("l1") ||
      text.includes("overfitting") ||
      text.includes("bias-variance")
    ) {
      return "optimization";
    }

    if (
      text.includes("distributed") ||
      text.includes("gpu") ||
      text.includes("cuda") ||
      text.includes("kernel") ||
      text.includes("all-reduce") ||
      text.includes("cluster") ||
      text.includes("parallel")
    ) {
      return "distributed";
    }

    if (
      text.includes("classification") ||
      text.includes("supervised") ||
      text.includes("boundary") ||
      text.includes("svm") ||
      text.includes("logistic") ||
      text.includes("decision")
    ) {
      return "classification";
    }

    if (
      text.includes("nlp") ||
      text.includes("token") ||
      text.includes("embedding") ||
      text.includes("vocabulary") ||
      text.includes("semantic")
    ) {
      return "nlp";
    }

    return "general";
  }, [question.topic, question.subtopic, question.prompt]);

  return (
    <div className="mt-5 rounded-lg border border-[var(--seam)] bg-[var(--substrate)] overflow-hidden">
      {/* Header bar of visual frame */}
      <div className="flex items-center justify-between border-b border-[var(--seam)] bg-[var(--panel)]/60 px-3.5 py-2 text-[11px] text-[var(--ink-lead)]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--tungsten)] opacity-80" />
          <span className="font-mono font-medium text-[var(--ink-chalk)]">
            {getVisualHeader(category, question)}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase text-[var(--ink-lead)]">
          {question.topic.replace("-", " ")}
        </span>
      </div>

      {/* SVG Diagram Canvas */}
      <div className="p-4 flex items-center justify-center bg-[var(--substrate)]/80">
        {category === "attention" && <AttentionDiagram />}
        {category === "backprop" && <BackpropDiagram />}
        {category === "statistics" && <StatisticsDiagram />}
        {category === "optimization" && <OptimizationDiagram />}
        {category === "distributed" && <DistributedDiagram />}
        {category === "classification" && <ClassificationDiagram />}
        {category === "nlp" && <NlpEmbeddingDiagram />}
        {category === "general" && <GeneralModelDiagram topic={question.topic} />}
      </div>

      {/* Contextual Code / Specification Footer */}
      <div className="border-t border-[var(--seam)] bg-[var(--panel)]/40 p-3 font-mono text-[11px] text-[var(--ink-chalk)]">
        {renderContextSpec(category, question)}
      </div>
    </div>
  );
}

function getVisualHeader(cat: VisualCategory, q: QuestionDTO): string {
  switch (cat) {
    case "attention":
      return "Multi-Head Attention Tensor Schema";
    case "backprop":
      return "Computational Gradient Flow Graph";
    case "statistics":
      return "Gaussian Distribution & Density Estimator";
    case "optimization":
      return "Loss Landscape & Descent Trajectory";
    case "distributed":
      return "Ring All-Reduce GPU Pipeline";
    case "classification":
      return "Decision Boundary & Feature Partition";
    case "nlp":
      return "Latent Embedding Vector Projection";
    default:
      return `${q.topic.toUpperCase()} // Architecture Graph`;
  }
}

// 1. Attention & Transformers Diagram
function AttentionDiagram() {
  return (
    <svg viewBox="0 0 520 180" className="w-full max-w-[480px] h-auto select-none" aria-label="Attention Mechanism Schema">
      <defs>
        <linearGradient id="qkvGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--tungsten)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Inputs Q, K, V */}
      <g transform="translate(20, 25)">
        <rect x="0" y="0" width="60" height="34" rx="4" fill="var(--panel)" stroke="var(--seam-highlight)" />
        <text x="30" y="22" textAnchor="middle" fill="var(--ink-chalk)" fontSize="12" fontFamily="monospace" fontWeight="600">Q</text>
        <text x="30" y="46" textAnchor="middle" fill="var(--ink-lead)" fontSize="9" fontFamily="monospace">[B, S, Dk]</text>
      </g>

      <g transform="translate(20, 75)">
        <rect x="0" y="0" width="60" height="34" rx="4" fill="var(--panel)" stroke="var(--seam-highlight)" />
        <text x="30" y="22" textAnchor="middle" fill="var(--ink-chalk)" fontSize="12" fontFamily="monospace" fontWeight="600">K</text>
        <text x="30" y="46" textAnchor="middle" fill="var(--ink-lead)" fontSize="9" fontFamily="monospace">[B, S, Dk]</text>
      </g>

      <g transform="translate(20, 125)">
        <rect x="0" y="0" width="60" height="34" rx="4" fill="var(--panel)" stroke="var(--seam-highlight)" />
        <text x="30" y="22" textAnchor="middle" fill="var(--ink-chalk)" fontSize="12" fontFamily="monospace" fontWeight="600">V</text>
        <text x="30" y="46" textAnchor="middle" fill="var(--ink-lead)" fontSize="9" fontFamily="monospace">[B, S, Dv]</text>
      </g>

      {/* Connectors to MatMul 1 */}
      <path d="M 80 42 L 140 70" stroke="var(--seam-highlight)" strokeWidth="1.5" fill="none" />
      <path d="M 80 92 L 140 75" stroke="var(--seam-highlight)" strokeWidth="1.5" fill="none" />

      {/* MatMul 1 (Q @ K^T) */}
      <g transform="translate(140, 55)">
        <rect x="0" y="0" width="75" height="35" rx="5" fill="var(--chassis)" stroke="var(--tungsten)" strokeWidth="1.2" />
        <text x="37" y="21" textAnchor="middle" fill="var(--tungsten)" fontSize="11" fontFamily="monospace" fontWeight="600">Q · Kᵀ</text>
      </g>

      {/* Scale & Softmax */}
      <path d="M 215 72 L 245 72" stroke="var(--seam-highlight)" strokeWidth="1.5" fill="none" />
      <g transform="translate(245, 55)">
        <rect x="0" y="0" width="85" height="35" rx="5" fill="var(--chassis)" stroke="var(--seam-highlight)" />
        <text x="42" y="16" textAnchor="middle" fill="var(--ink-chalk)" fontSize="10" fontFamily="monospace">Scale ÷√dk</text>
        <text x="42" y="28" textAnchor="middle" fill="var(--converged)" fontSize="9" fontFamily="monospace">Softmax</text>
      </g>

      {/* Attention Map Grid */}
      <path d="M 330 72 L 360 72" stroke="var(--seam-highlight)" strokeWidth="1.5" fill="none" />
      <path d="M 80 142 L 390 142 L 390 92" stroke="var(--seam-highlight)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />

      {/* MatMul 2 (Attn @ V) */}
      <g transform="translate(360, 55)">
        <rect x="0" y="0" width="70" height="35" rx="5" fill="var(--chassis)" stroke="var(--tungsten)" strokeWidth="1.2" />
        <text x="35" y="22" textAnchor="middle" fill="var(--tungsten)" fontSize="11" fontFamily="monospace" fontWeight="600">A · V</text>
      </g>

      {/* Output Projection */}
      <path d="M 430 72 L 460 72" stroke="var(--seam-highlight)" strokeWidth="1.5" fill="none" />
      <g transform="translate(460, 52)">
        <rect x="0" y="0" width="50" height="40" rx="5" fill="var(--panel)" stroke="var(--converged)" />
        <text x="25" y="21" textAnchor="middle" fill="var(--converged)" fontSize="11" fontFamily="monospace" fontWeight="700">Out</text>
        <text x="25" y="33" textAnchor="middle" fill="var(--ink-lead)" fontSize="8" fontFamily="monospace">[B,S,D]</text>
      </g>
    </svg>
  );
}

// 2. Backpropagation Diagram
function BackpropDiagram() {
  return (
    <svg viewBox="0 0 500 160" className="w-full max-w-[460px] h-auto select-none" aria-label="Backpropagation Computational Graph">
      {/* Forward Nodes */}
      <g transform="translate(40, 65)">
        <circle cx="20" cy="20" r="18" fill="var(--panel)" stroke="var(--seam-highlight)" strokeWidth="1.5" />
        <text x="20" y="24" textAnchor="middle" fill="var(--ink-chalk)" fontSize="11" fontFamily="monospace">x</text>
      </g>

      <path d="M 78 85 L 140 85" stroke="var(--tungsten)" strokeWidth="2" />

      <g transform="translate(140, 65)">
        <circle cx="20" cy="20" r="18" fill="var(--panel)" stroke="var(--tungsten)" strokeWidth="1.5" />
        <text x="20" y="24" textAnchor="middle" fill="var(--tungsten)" fontSize="11" fontFamily="monospace">W₁·x</text>
      </g>

      <path d="M 178 85 L 240 85" stroke="var(--tungsten)" strokeWidth="2" />

      <g transform="translate(240, 65)">
        <circle cx="20" cy="20" r="18" fill="var(--panel)" stroke="var(--seam-highlight)" strokeWidth="1.5" />
        <text x="20" y="24" textAnchor="middle" fill="var(--ink-chalk)" fontSize="11" fontFamily="monospace">σ(z)</text>
      </g>

      <path d="M 278 85 L 340 85" stroke="var(--tungsten)" strokeWidth="2" />

      <g transform="translate(340, 65)">
        <circle cx="20" cy="20" r="18" fill="var(--panel)" stroke="var(--tungsten)" strokeWidth="1.5" />
        <text x="20" y="24" textAnchor="middle" fill="var(--tungsten)" fontSize="11" fontFamily="monospace">ŷ</text>
      </g>

      <path d="M 378 85 L 430 85" stroke="var(--tungsten)" strokeWidth="2" />

      <g transform="translate(430, 65)">
        <rect x="0" y="2" width="40" height="34" rx="4" fill="var(--chassis)" stroke="var(--diverged)" strokeWidth="1.5" />
        <text x="20" y="23" textAnchor="middle" fill="var(--diverged)" fontSize="12" fontFamily="monospace" fontWeight="700">ℒ</text>
      </g>

      {/* Reverse gradient path (Backpropagation) */}
      <path d="M 430 115 C 380 145, 180 145, 140 115" stroke="var(--converged)" strokeWidth="1.8" strokeDasharray="4 3" fill="none" />
      <text x="280" y="145" textAnchor="middle" fill="var(--converged)" fontSize="10" fontFamily="monospace">
        ← Backward: ∂ℒ/∂W = ∂ℒ/∂ŷ · ∂ŷ/∂z · ∂z/∂W
      </text>
    </svg>
  );
}

// 3. Statistics & Normal Distribution
function StatisticsDiagram() {
  return (
    <svg viewBox="0 0 500 160" className="w-full max-w-[460px] h-auto select-none" aria-label="Gaussian Normal Distribution">
      <defs>
        <linearGradient id="bellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--tungsten)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--tungsten)" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Axis */}
      <line x1="40" y1="130" x2="460" y2="130" stroke="var(--seam-highlight)" strokeWidth="1.5" />

      {/* Shaded Area under Curve (±1σ) */}
      <path
        d="M 180 130 C 200 95, 230 45, 250 40 C 270 45, 300 95, 320 130 Z"
        fill="url(#bellGrad)"
      />

      {/* Bell Curve */}
      <path
        d="M 50 130 C 130 130, 180 110, 210 70 C 235 35, 265 35, 290 70 C 320 110, 370 130, 450 130"
        stroke="var(--tungsten)"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Center Mean line */}
      <line x1="250" y1="35" x2="250" y2="130" stroke="var(--ink-chalk)" strokeWidth="1.2" strokeDasharray="3 3" />
      <text x="250" y="146" textAnchor="middle" fill="var(--ink-chalk)" fontSize="11" fontFamily="monospace">μ</text>

      {/* Standard Dev Markers */}
      <line x1="180" y1="95" x2="180" y2="130" stroke="var(--seam-highlight)" strokeWidth="1" strokeDasharray="2 2" />
      <text x="180" y="146" textAnchor="middle" fill="var(--ink-lead)" fontSize="10" fontFamily="monospace">-1σ</text>

      <line x1="320" y1="95" x2="320" y2="130" stroke="var(--seam-highlight)" strokeWidth="1" strokeDasharray="2 2" />
      <text x="320" y="146" textAnchor="middle" fill="var(--ink-lead)" fontSize="10" fontFamily="monospace">+1σ</text>

      {/* 68% Coverage pill */}
      <rect x="215" y="65" width="70" height="20" rx="3" fill="var(--chassis)" stroke="var(--tungsten)" strokeWidth="1" />
      <text x="250" y="79" textAnchor="middle" fill="var(--tungsten)" fontSize="10" fontFamily="monospace" fontWeight="600">~68.2%</text>
    </svg>
  );
}

// 4. Optimization & Loss Landscape Diagram
function OptimizationDiagram() {
  return (
    <svg viewBox="0 0 500 160" className="w-full max-w-[460px] h-auto select-none" aria-label="Optimization Contour Landscape">
      {/* Contours */}
      <ellipse cx="250" cy="80" rx="200" ry="60" fill="none" stroke="var(--seam)" strokeWidth="1" />
      <ellipse cx="250" cy="80" rx="140" ry="42" fill="none" stroke="var(--seam-highlight)" strokeWidth="1.2" />
      <ellipse cx="250" cy="80" rx="80" ry="24" fill="none" stroke="var(--tungsten)" strokeWidth="1.2" strokeOpacity="0.6" />
      <ellipse cx="250" cy="80" rx="25" ry="8" fill="var(--tungsten)" fillOpacity="0.15" stroke="var(--tungsten)" strokeWidth="1.5" />

      {/* Center Minimum */}
      <circle cx="250" cy="80" r="3" fill="var(--converged)" />
      <text x="250" y="102" textAnchor="middle" fill="var(--converged)" fontSize="10" fontFamily="monospace" fontWeight="bold">θ* (Global Min)</text>

      {/* Trajectory */}
      <path
        d="M 100 40 Q 140 70 170 65 T 210 75 T 245 80"
        stroke="var(--diverged)"
        strokeWidth="2"
        fill="none"
        strokeDasharray="4 2"
      />
      <circle cx="100" cy="40" r="4" fill="var(--diverged)" />
      <text x="100" y="30" textAnchor="middle" fill="var(--diverged)" fontSize="9" fontFamily="monospace">Init θ₀</text>

      {/* Momentum Step Vector */}
      <path d="M 170 65 L 205 74" stroke="var(--tungsten)" strokeWidth="2" />
      <text x="370" y="45" textAnchor="end" fill="var(--ink-lead)" fontSize="10" fontFamily="monospace">
        Gradient Update: θ ← θ - η·∇ℒ(θ)
      </text>
    </svg>
  );
}

// 5. Distributed Systems & GPU Cluster Diagram
function DistributedDiagram() {
  return (
    <svg viewBox="0 0 500 160" className="w-full max-w-[460px] h-auto select-none" aria-label="Distributed GPU Cluster Ring All-Reduce">
      {/* 4 GPU Nodes */}
      {[
        { id: 0, x: 80, y: 35 },
        { id: 1, x: 280, y: 35 },
        { id: 2, x: 280, y: 100 },
        { id: 3, x: 80, y: 100 },
      ].map((gpu) => (
        <g key={gpu.id} transform={`translate(${gpu.x}, ${gpu.y})`}>
          <rect x="0" y="0" width="130" height="38" rx="5" fill="var(--chassis)" stroke="var(--seam-highlight)" />
          <circle cx="18" cy="19" r="6" fill="var(--converged)" />
          <text x="32" y="23" fill="var(--ink-chalk)" fontSize="11" fontFamily="monospace" fontWeight="600">
            GPU {gpu.id}
          </text>
          <text x="95" y="23" fill="var(--tungsten)" fontSize="9" fontFamily="monospace">
            NVLink
          </text>
        </g>
      ))}

      {/* Ring Communication Arrows */}
      <path d="M 210 54 L 280 54" stroke="var(--tungsten)" strokeWidth="2" strokeDasharray="3 2" />
      <path d="M 345 73 L 345 100" stroke="var(--tungsten)" strokeWidth="2" strokeDasharray="3 2" />
      <path d="M 280 119 L 210 119" stroke="var(--tungsten)" strokeWidth="2" strokeDasharray="3 2" />
      <path d="M 145 100 L 145 73" stroke="var(--tungsten)" strokeWidth="2" strokeDasharray="3 2" />

      <text x="250" y="90" textAnchor="middle" fill="var(--ink-lead)" fontSize="10" fontFamily="monospace">
        Ring All-Reduce (2 × (N-1) / N)
      </text>
    </svg>
  );
}

// 6. Classification & Decision Boundary
function ClassificationDiagram() {
  return (
    <svg viewBox="0 0 500 160" className="w-full max-w-[460px] h-auto select-none" aria-label="Classification Decision Boundary">
      {/* Boundary Line */}
      <line x1="80" y1="140" x2="400" y2="20" stroke="var(--tungsten)" strokeWidth="2.5" />
      <line x1="60" y1="125" x2="380" y2="5" stroke="var(--seam-highlight)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="100" y1="155" x2="420" y2="35" stroke="var(--seam-highlight)" strokeWidth="1" strokeDasharray="3 3" />

      {/* Class 0 Points (Red/Lead) */}
      {[
        [100, 110], [130, 95], [90, 80], [160, 120], [140, 70], [190, 100]
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="var(--diverged)" opacity="0.8" />
      ))}

      {/* Class 1 Points (Green/Converged) */}
      {[
        [320, 60], [350, 45], [370, 75], [310, 30], [390, 50], [280, 40]
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="var(--converged)" opacity="0.8" />
      ))}

      <text x="130" y="50" fill="var(--diverged)" fontSize="11" fontFamily="monospace" fontWeight="600">Class 0 (y=0)</text>
      <text x="350" y="120" fill="var(--converged)" fontSize="11" fontFamily="monospace" fontWeight="600">Class 1 (y=1)</text>
      <text x="250" y="145" textAnchor="middle" fill="var(--ink-lead)" fontSize="10" fontFamily="monospace">
        Hyperplane: wᵀx + b = 0
      </text>
    </svg>
  );
}

// 7. NLP & Latent Space Embeddings
function NlpEmbeddingDiagram() {
  return (
    <svg viewBox="0 0 500 160" className="w-full max-w-[460px] h-auto select-none" aria-label="NLP Latent Space Embeddings">
      {/* Origin */}
      <circle cx="100" cy="120" r="4" fill="var(--ink-lead)" />

      {/* Vector 1 (Token A) */}
      <line x1="100" y1="120" x2="300" y2="40" stroke="var(--tungsten)" strokeWidth="2.5" />
      <circle cx="300" cy="40" r="6" fill="var(--tungsten)" />
      <text x="312" y="44" fill="var(--tungsten)" fontSize="11" fontFamily="monospace" fontWeight="600">vec(&quot;transformer&quot;)</text>

      {/* Vector 2 (Token B) */}
      <line x1="100" y1="120" x2="340" y2="70" stroke="var(--converged)" strokeWidth="2" />
      <circle cx="340" cy="70" r="6" fill="var(--converged)" />
      <text x="352" y="74" fill="var(--converged)" fontSize="11" fontFamily="monospace" fontWeight="600">vec(&quot;attention&quot;)</text>

      {/* Angle Arc (Cosine Sim) */}
      <path d="M 180 88 A 90 90 0 0 1 200 102" stroke="var(--ink-chalk)" strokeWidth="1.5" fill="none" strokeDasharray="2 2" />
      <text x="220" y="98" fill="var(--ink-chalk)" fontSize="10" fontFamily="monospace">cos(θ) ≈ 0.94</text>

      <text x="250" y="145" textAnchor="middle" fill="var(--ink-lead)" fontSize="10" fontFamily="monospace">
        Cosine Similarity: (u · v) / (||u|| ||v||)
      </text>
    </svg>
  );
}

// 8. General Topic Architecture Diagram
function GeneralModelDiagram({ topic }: { topic: string }) {
  return (
    <svg viewBox="0 0 500 160" className="w-full max-w-[460px] h-auto select-none" aria-label="General ML Model Workflow">
      {/* Pipeline Blocks */}
      <g transform="translate(40, 60)">
        <rect x="0" y="0" width="100" height="40" rx="4" fill="var(--panel)" stroke="var(--seam-highlight)" />
        <text x="50" y="24" textAnchor="middle" fill="var(--ink-chalk)" fontSize="11" fontFamily="monospace">Dataset X, y</text>
      </g>

      <path d="M 140 80 L 190 80" stroke="var(--seam-highlight)" strokeWidth="2" />

      <g transform="translate(190, 55)">
        <rect x="0" y="0" width="120" height="50" rx="5" fill="var(--chassis)" stroke="var(--tungsten)" strokeWidth="1.5" />
        <text x="60" y="25" textAnchor="middle" fill="var(--tungsten)" fontSize="11" fontFamily="monospace" fontWeight="600">{topic}</text>
        <text x="60" y="40" textAnchor="middle" fill="var(--ink-lead)" fontSize="9" fontFamily="monospace">Param Space θ</text>
      </g>

      <path d="M 310 80 L 360 80" stroke="var(--seam-highlight)" strokeWidth="2" />

      <g transform="translate(360, 60)">
        <rect x="0" y="0" width="100" height="40" rx="4" fill="var(--panel)" stroke="var(--converged)" />
        <text x="50" y="24" textAnchor="middle" fill="var(--converged)" fontSize="11" fontFamily="monospace">Inference ŷ</text>
      </g>

      <text x="250" y="140" textAnchor="middle" fill="var(--ink-lead)" fontSize="10" fontFamily="monospace">
        Hoopr Computational Verification Engine
      </text>
    </svg>
  );
}

function renderContextSpec(cat: VisualCategory, q: QuestionDTO) {
  switch (cat) {
    case "attention":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">Tensors:</strong> Q, K ∈ ℝ^(B×H×S×Dk), V ∈ ℝ^(B×H×S×Dv)
          </span>
          <span className="text-[var(--converged)]">Complexity: O(B · H · S²)</span>
        </div>
      );
    case "backprop":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">Autograd:</strong> Vector-Jacobian Product (VJP) in PyTorch
          </span>
          <span className="text-[var(--converged)]">Memory: O(Layers × Activations)</span>
        </div>
      );
    case "statistics":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">PDF:</strong> f(x) = (1 / σ√(2π)) · exp(-0.5 · ((x-μ)/σ)²)
          </span>
          <span className="text-[var(--converged)]">Confidence: 95% at ±1.96σ</span>
        </div>
      );
    case "optimization":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">Rule:</strong> m_t = β₁m_(t-1) + (1-β₁)g_t; v_t = β₂v_(t-1) + (1-β₂)g_t²
          </span>
          <span className="text-[var(--converged)]">Adam Optimizer default (β₁=0.9, β₂=0.999)</span>
        </div>
      );
    case "distributed":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">Topology:</strong> NCCL Ring All-Reduce across accelerator nodes
          </span>
          <span className="text-[var(--converged)]">Comm Volume: 2 · (N-1)/N · M</span>
        </div>
      );
    case "classification":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">Objective:</strong> ℒ(w, b) = -1/N Σ [y_i log(σ(z_i)) + (1-y_i) log(1-σ(z_i))]
          </span>
          <span className="text-[var(--converged)]">Binary Cross-Entropy</span>
        </div>
      );
    case "nlp":
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">Space:</strong> d_model = 4096, vocab_size = 32,000 tokens
          </span>
          <span className="text-[var(--converged)]">Rotary Position Embeddings (RoPE)</span>
        </div>
      );
    default:
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong className="text-[var(--tungsten)]">Domain:</strong> {q.topic} // {q.subtopic ?? "general"}
          </span>
          <span className="text-[var(--converged)]">Deterministic Grading Active</span>
        </div>
      );
  }
}
