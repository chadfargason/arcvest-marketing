const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

function getHeaders() {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error('GHL_API_KEY is not set');

  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: GHL_API_VERSION,
  };
}

export async function createContact(params: {
  firstName: string;
  email: string;
  phone: string;
  tags: string[];
  source: string;
}) {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) throw new Error('GHL_LOCATION_ID is not set');

  const response = await fetch(`${GHL_BASE_URL}/contacts/`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      locationId,
      firstName: params.firstName,
      email: params.email,
      phone: params.phone,
      tags: params.tags,
      source: params.source,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GHL createContact failed (${response.status}): ${error}`);
  }

  return response.json() as Promise<{ contact: { id: string } }>;
}

export async function createAppointment(params: {
  contactId: string;
  calendarId: string;
  startTime: string;
  endTime: string;
  title: string;
}) {
  const response = await fetch(
    `${GHL_BASE_URL}/calendars/events/appointments`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        calendarId: params.calendarId,
        contactId: params.contactId,
        startTime: params.startTime,
        endTime: params.endTime,
        title: params.title,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `GHL createAppointment failed (${response.status}): ${error}`
    );
  }

  return response.json() as Promise<{ id: string }>;
}
