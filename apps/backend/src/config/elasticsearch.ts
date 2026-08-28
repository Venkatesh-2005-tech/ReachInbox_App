import { Client } from '@elastic/elasticsearch';
import { env } from './env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
});

export const EMAIL_INDEX = 'emails';

export async function initElasticsearch(): Promise<void> {
  try {
    await esClient.ping();
    console.log('✅ Elasticsearch connected');

    const indexExists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text' },
            body: { type: 'text' },
            senderId: { type: 'keyword' },
            userId: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ Elasticsearch index "${EMAIL_INDEX}" created`);
    } else {
      console.log(`✅ Elasticsearch index "${EMAIL_INDEX}" already exists`);
    }
  } catch (err) {
    console.warn('⚠️  Elasticsearch not available — search features will be degraded:', (err as Error).message);
  }
}
