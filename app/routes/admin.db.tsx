import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import prisma from "../db.server";

export async function loader() {
  try {
    // Get all data from both tables
    const sessions = await prisma.session.findMany();
    const models = await prisma.model.findMany();

    return json({
      success: true,
      data: {
        sessions,
        models,
        counts: {
          sessions: sessions.length,
          models: models.length
        }
      }
    });
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: null
    });
  }
}

export default function DatabaseAdmin() {
  const data = useLoaderData<typeof loader>();

  if (!data.success) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>Database Error</h1>
        <p style={{ color: 'red' }}>Error: {'error' in data ? data.error : 'Unknown error'}</p>
      </div>
    );
  }

  if (!data.data) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        <h1>Database Error</h1>
        <p style={{ color: 'red' }}>No data available</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Database Content</h1>
      
      <h2>Summary</h2>
      <p><strong>Sessions:</strong> {data.data.counts.sessions}</p>
      <p><strong>Models:</strong> {data.data.counts.models}</p>

      <h2>Sessions</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
        {JSON.stringify(data.data.sessions, null, 2)}
      </pre>

      <h2>Models</h2>
      <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
        {JSON.stringify(data.data.models, null, 2)}
      </pre>
    </div>
  );
}