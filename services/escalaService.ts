
import { EscalaConfig } from "../types";
import { getAppConfig, saveAppConfig } from "./firestoreService";

/**
 * Escala Service
 * Handles lead ingestion and CRM updates for Escala.com
 * Research Note: Escala API expects contact objects with specific 'custom_fields' 
 * for effective lead segmentation and marketing automation.
 */

const ESCALA_API_BASE = "https://api.escala.com/v1";

export const getEscalaConfig = async (): Promise<EscalaConfig> => {
  const config = await getAppConfig();
  if (config) {
    return {
      apiKey: config.escalaApiKey || '',
      accountId: config.escalaAccountId || '',
      isActive: config.escalaIsActive || false
    };
  }
  return { apiKey: '', accountId: '', isActive: false };
};

export const saveEscalaConfig = async (config: EscalaConfig) => {
  await saveAppConfig({
    escalaApiKey: config.apiKey,
    escalaAccountId: config.accountId,
    escalaIsActive: config.isActive
  });
};

export const syncLeadToEscala = async (data: {
  name: string;
  email?: string;
  phone?: string;
  message: string;
  tags: string[];
  customFields?: Record<string, string>;
}) => {
  const config = await getEscalaConfig();
  if (!config.isActive || !config.apiKey) {
    console.warn("[Escala CRM] Integration inactive. Logging locally only.");
    return { success: false, reason: 'inactive' };
  }

  try {
    // Lead Capture Endpoint
    const response = await fetch(`${ESCALA_API_BASE}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Account-Id': config.accountId
      },
      body: JSON.stringify({
        first_name: data.name,
        email: data.email || `visitor_${Date.now()}@unitec-ai.com`,
        phone: data.phone || '',
        description: data.message,
        tags: [...data.tags, 'AI_FRONT_DESK_SOURCE'],
        custom_fields: {
          ...data.customFields,
          lead_source: 'AI_RECEPTIONIST',
          interaction_timestamp: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Escala API HTTP ${response.status}: ${err}`);
    }

    console.log("[Escala CRM] Lead successfully synchronized.");
    return { success: true };
  } catch (error) {
    console.error("[Escala CRM] Sync Failed:", error);
    return { success: false, reason: 'error', error };
  }
};

export const testEscalaConnection = async (config: EscalaConfig) => {
  try {
    // Check account status or profile to verify API key validity
    const response = await fetch(`${ESCALA_API_BASE}/account/profile`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'X-Account-Id': config.accountId
      }
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};
