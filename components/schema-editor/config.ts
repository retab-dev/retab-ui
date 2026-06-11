import {
  DollarSign,
  Truck,
  User,
  TrendingUp,
  FileText,
  Building,
  Heart,
  Shapes,
} from "lucide-react";

export interface Template {
  id: string;
  name: string;
}

export interface FullTemplate {
  id: string;
  name: string;
  json_schema: Record<string, unknown>;
}

export interface TemplateCategory {
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  templates: Template[];
}

// Import all template JSON files statically
import tplt_tz9Ib2B_A62qDjo_SxeVR from "./templates/tplt_tz9Ib2B_A62qDjo-SxeVR.json";
import tplt_Ipi2YlRWGsYui_Q8wlzl3 from "./templates/tplt_Ipi2YlRWGsYui_Q8wlzl3.json";
import tplt_7m77FsPsg6B3e5FntRLOm from "./templates/tplt_7m77FsPsg6B3e5FntRLOm.json";
import tplt_Xk2fjkB2wje4OZ3QqswFC from "./templates/tplt_Xk2fjkB2wje4OZ3QqswFC.json";
import tplt_1GfDZQliNtNWY4oavwTAP from "./templates/tplt_1GfDZQliNtNWY4oavwTAP.json";
import tplt_Y9fxTWXpqRBelXrMaxdgW from "./templates/tplt_Y9fxTWXpqRBelXrMaxdgW.json";
import tplt_s_UDN_7RWDi0bQnFQyymS from "./templates/tplt_s-UDN-7RWDi0bQnFQyymS.json";
import tplt_Aw5xYwK8Klg1bjQ6odlHn from "./templates/tplt_Aw5xYwK8Klg1bjQ6odlHn.json";
import tplt_NqvkeTrILaS2UG_hhkNYI from "./templates/tplt_NqvkeTrILaS2UG-hhkNYI.json";
import tplt_Woa_abHQZNjpVwabmQXBx from "./templates/tplt_Woa_abHQZNjpVwabmQXBx.json";
import tplt_ONzWxTQx2TRr5UpY9i_5l from "./templates/tplt_ONzWxTQx2TRr5UpY9i_5l.json";
import tplt_oUOVuemu4lompWhwNl8KA from "./templates/tplt_oUOVuemu4lompWhwNl8KA.json";
import tplt_z927VqG6HVrNMlMZVbDAA from "./templates/tplt_z927VqG6HVrNMlMZVbDAA.json";
import tplt_ObNpCtDS2zzRQNnJkxBp6 from "./templates/tplt_ObNpCtDS2zzRQNnJkxBp6.json";
import tplt_sO_uxsPUimkVg2qHybCDr from "./templates/tplt_sO_uxsPUimkVg2qHybCDr.json";
import tplt_NicGt3PJikntykFkoVRGw from "./templates/tplt_NicGt3PJikntykFkoVRGw.json";
import tplt_KY6Hqf5PK6I_yirCQzVNK from "./templates/tplt_KY6Hqf5PK6I_yirCQzVNK.json";
import tplt_UFHef7Y7rftdg9ug1Lhdn from "./templates/tplt_UFHef7Y7rftdg9ug1Lhdn.json";
import tplt_4zkEhfxy7rHtrDTDEv9gC from "./templates/tplt_4zkEhfxy7rHtrDTDEv9gC.json";
import tplt_2jGcZ2KuC5ZWAMWgGFJDw from "./templates/tplt_2jGcZ2KuC5ZWAMWgGFJDw.json";
import tplt_BSAdRRLX_PdtcsUdW5z33 from "./templates/tplt_BSAdRRLX_PdtcsUdW5z33.json";
import tplt_0CvpRWs8U88kAIc6TMbAj from "./templates/tplt_0CvpRWs8U88kAIc6TMbAj.json";
import tplt_MFKhokEsgLSky5wsLc1Fo from "./templates/tplt_MFKhokEsgLSky5wsLc1Fo.json";
import tplt_qxoFCiR8smfcg58xgQ26F from "./templates/tplt_qxoFCiR8smfcg58xgQ26F.json";
import tplt_1u1RMSWtGiG7pifgWZxh_ from "./templates/tplt_1u1RMSWtGiG7pifgWZxh-.json";
import tplt_ovBbqbKifJRuXJbKksOAI from "./templates/tplt_ovBbqbKifJRuXJbKksOAI.json";
import tplt_fhUJzI79FAaSUvfuuxgD2 from "./templates/tplt_fhUJzI79FAaSUvfuuxgD2.json";
import tplt_vYw_6UIEZh_7zA_D02QK2 from "./templates/tplt_vYw_6UIEZh_7zA-D02QK2.json";
import tplt_nhCxf28nv2t5G_kR_xFQG from "./templates/tplt_nhCxf28nv2t5G-kR_xFQG.json";
import tplt_aGVIiJ9ars1CI9iPPsS_f from "./templates/tplt_aGVIiJ9ars1CI9iPPsS-f.json";
import tplt_BBAhpd5DQN9WMFjLvvoqV from "./templates/tplt_BBAhpd5DQN9WMFjLvvoqV.json";
import tplt__3fikppWqlJVHRkMNE0LV from "./templates/tplt_-3fikppWqlJVHRkMNE0LV.json";
import tplt_45F4KrBIyW__ezDa2VWN_ from "./templates/tplt_45F4KrBIyW_-ezDa2VWN-.json";
import tplt_m5BiDwAgVHh6ppxN8Ronz from "./templates/tplt_m5BiDwAgVHh6ppxN8Ronz.json";
import tplt_JYMkgIy9S2QAz7pQtsHLV from "./templates/tplt_JYMkgIy9S2QAz7pQtsHLV.json";

// Map template IDs to their JSON schemas
export const templateSchemas: Record<string, Record<string, unknown>> = {
  "tplt_tz9Ib2B_A62qDjo-SxeVR": tplt_tz9Ib2B_A62qDjo_SxeVR,
  tplt_Ipi2YlRWGsYui_Q8wlzl3: tplt_Ipi2YlRWGsYui_Q8wlzl3,
  tplt_7m77FsPsg6B3e5FntRLOm: tplt_7m77FsPsg6B3e5FntRLOm,
  tplt_Xk2fjkB2wje4OZ3QqswFC: tplt_Xk2fjkB2wje4OZ3QqswFC,
  tplt_1GfDZQliNtNWY4oavwTAP: tplt_1GfDZQliNtNWY4oavwTAP,
  tplt_Y9fxTWXpqRBelXrMaxdgW: tplt_Y9fxTWXpqRBelXrMaxdgW,
  "tplt_s-UDN-7RWDi0bQnFQyymS": tplt_s_UDN_7RWDi0bQnFQyymS,
  tplt_Aw5xYwK8Klg1bjQ6odlHn: tplt_Aw5xYwK8Klg1bjQ6odlHn,
  "tplt_NqvkeTrILaS2UG-hhkNYI": tplt_NqvkeTrILaS2UG_hhkNYI,
  tplt_Woa_abHQZNjpVwabmQXBx: tplt_Woa_abHQZNjpVwabmQXBx,
  tplt_ONzWxTQx2TRr5UpY9i_5l: tplt_ONzWxTQx2TRr5UpY9i_5l,
  tplt_oUOVuemu4lompWhwNl8KA: tplt_oUOVuemu4lompWhwNl8KA,
  tplt_z927VqG6HVrNMlMZVbDAA: tplt_z927VqG6HVrNMlMZVbDAA,
  tplt_ObNpCtDS2zzRQNnJkxBp6: tplt_ObNpCtDS2zzRQNnJkxBp6,
  tplt_sO_uxsPUimkVg2qHybCDr: tplt_sO_uxsPUimkVg2qHybCDr,
  tplt_NicGt3PJikntykFkoVRGw: tplt_NicGt3PJikntykFkoVRGw,
  tplt_KY6Hqf5PK6I_yirCQzVNK: tplt_KY6Hqf5PK6I_yirCQzVNK,
  tplt_UFHef7Y7rftdg9ug1Lhdn: tplt_UFHef7Y7rftdg9ug1Lhdn,
  tplt_4zkEhfxy7rHtrDTDEv9gC: tplt_4zkEhfxy7rHtrDTDEv9gC,
  tplt_2jGcZ2KuC5ZWAMWgGFJDw: tplt_2jGcZ2KuC5ZWAMWgGFJDw,
  tplt_BSAdRRLX_PdtcsUdW5z33: tplt_BSAdRRLX_PdtcsUdW5z33,
  tplt_0CvpRWs8U88kAIc6TMbAj: tplt_0CvpRWs8U88kAIc6TMbAj,
  tplt_MFKhokEsgLSky5wsLc1Fo: tplt_MFKhokEsgLSky5wsLc1Fo,
  tplt_qxoFCiR8smfcg58xgQ26F: tplt_qxoFCiR8smfcg58xgQ26F,
  "tplt_1u1RMSWtGiG7pifgWZxh-": tplt_1u1RMSWtGiG7pifgWZxh_,
  tplt_ovBbqbKifJRuXJbKksOAI: tplt_ovBbqbKifJRuXJbKksOAI,
  tplt_fhUJzI79FAaSUvfuuxgD2: tplt_fhUJzI79FAaSUvfuuxgD2,
  "tplt_vYw_6UIEZh_7zA-D02QK2": tplt_vYw_6UIEZh_7zA_D02QK2,
  "tplt_nhCxf28nv2t5G-kR_xFQG": tplt_nhCxf28nv2t5G_kR_xFQG,
  "tplt_aGVIiJ9ars1CI9iPPsS-f": tplt_aGVIiJ9ars1CI9iPPsS_f,
  tplt_BBAhpd5DQN9WMFjLvvoqV: tplt_BBAhpd5DQN9WMFjLvvoqV,
  "tplt_-3fikppWqlJVHRkMNE0LV": tplt__3fikppWqlJVHRkMNE0LV,
  "tplt_45F4KrBIyW_-ezDa2VWN-": tplt_45F4KrBIyW__ezDa2VWN_,
  tplt_m5BiDwAgVHh6ppxN8Ronz: tplt_m5BiDwAgVHh6ppxN8Ronz,
  tplt_JYMkgIy9S2QAz7pQtsHLV: tplt_JYMkgIy9S2QAz7pQtsHLV,
};

// Helper function to get a full template with json_schema
export function getFullTemplate(template: Template): FullTemplate {
  const schema = templateSchemas[template.id];
  if (!schema) {
    console.warn(`Template schema not found for id: ${template.id}`);
  }
  return {
    id: template.id,
    name: template.name,
    json_schema: schema || {},
  };
}

export const templateCategories: TemplateCategory[] = [
  {
    name: "Classification",
    icon: Shapes,
    templates: [
      { id: "tplt_tz9Ib2B_A62qDjo-SxeVR", name: "Sentiment Analysis" },
      { id: "tplt_Ipi2YlRWGsYui_Q8wlzl3", name: "HR Screening" },
      { id: "tplt_7m77FsPsg6B3e5FntRLOm", name: "Ticket Triage" },
      { id: "tplt_Xk2fjkB2wje4OZ3QqswFC", name: "Article Classification" },
      { id: "tplt_1GfDZQliNtNWY4oavwTAP", name: "Safety Tagging" },
    ],
  },
  {
    name: "Identity",
    icon: User,
    templates: [
      { id: "tplt_Y9fxTWXpqRBelXrMaxdgW", name: "Identity Card" },
      { id: "tplt_s-UDN-7RWDi0bQnFQyymS", name: "Passport" },
      { id: "tplt_Aw5xYwK8Klg1bjQ6odlHn", name: "Driver's license (US)" },
      { id: "tplt_NqvkeTrILaS2UG-hhkNYI", name: "W2" },
    ],
  },
  {
    name: "Finance",
    icon: DollarSign,
    templates: [
      { id: "tplt_Woa_abHQZNjpVwabmQXBx", name: "Bank Statement" },
      { id: "tplt_ONzWxTQx2TRr5UpY9i_5l", name: "Invoice" },
      { id: "tplt_oUOVuemu4lompWhwNl8KA", name: "Credit Card" },
      { id: "tplt_z927VqG6HVrNMlMZVbDAA", name: "Pay Slip" },
      { id: "tplt_ObNpCtDS2zzRQNnJkxBp6", name: "Expense" },
      { id: "tplt_sO_uxsPUimkVg2qHybCDr", name: "Contract" },
    ],
  },
  {
    name: "Logistics",
    icon: Truck,
    templates: [
      { id: "tplt_NicGt3PJikntykFkoVRGw", name: "Air Waybill" },
      { id: "tplt_KY6Hqf5PK6I_yirCQzVNK", name: "Bill of Lading" },
      { id: "tplt_UFHef7Y7rftdg9ug1Lhdn", name: "Booking Confirmation" },
      { id: "tplt_4zkEhfxy7rHtrDTDEv9gC", name: "Trucking Invoice" },
      { id: "tplt_2jGcZ2KuC5ZWAMWgGFJDw", name: "Packing List" },
      { id: "tplt_BSAdRRLX_PdtcsUdW5z33", name: "Warehouse Receipt" },
    ],
  },
  {
    name: "Investment",
    icon: TrendingUp,
    templates: [
      { id: "tplt_0CvpRWs8U88kAIc6TMbAj", name: "Pitch Deck" },
      { id: "tplt_MFKhokEsgLSky5wsLc1Fo", name: "Form S-1" },
      { id: "tplt_qxoFCiR8smfcg58xgQ26F", name: "Balance Sheet" },
      { id: "tplt_1u1RMSWtGiG7pifgWZxh-", name: "10Q" },
      { id: "tplt_ovBbqbKifJRuXJbKksOAI", name: "10K" },
    ],
  },
  {
    name: "Healthcare",
    icon: Heart,
    templates: [
      { id: "tplt_fhUJzI79FAaSUvfuuxgD2", name: "Lab Report" },
      { id: "tplt_vYw_6UIEZh_7zA-D02QK2", name: "Medical Record" },
    ],
  },
  {
    name: "HR",
    icon: FileText,
    templates: [
      { id: "tplt_nhCxf28nv2t5G-kR_xFQG", name: "Cover Letter" },
      { id: "tplt_aGVIiJ9ars1CI9iPPsS-f", name: "Reference List" },
      { id: "tplt_BBAhpd5DQN9WMFjLvvoqV", name: "Resume" },
    ],
  },
  {
    name: "Real Estate",
    icon: Building,
    templates: [
      { id: "tplt_-3fikppWqlJVHRkMNE0LV", name: "Rent Roll" },
      { id: "tplt_45F4KrBIyW_-ezDa2VWN-", name: "Lease Agreement" },

      { id: "tplt_m5BiDwAgVHh6ppxN8Ronz", name: "Management Report" },
      { id: "tplt_JYMkgIy9S2QAz7pQtsHLV", name: "Inspection Report" },
    ],
  },
];
