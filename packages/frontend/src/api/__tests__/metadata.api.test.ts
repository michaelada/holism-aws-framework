import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataApi } from '../metadata.api';
import { InstancesApi } from '../instances.api';
import type { ApiClient } from '../client';

/**
 * The URLs this app speaks to the metadata service over.
 *
 * These wrappers hold no logic, which is exactly why they are worth pinning: a
 * wrong verb or a path off by one segment is invisible in review and produces a
 * 404 at runtime with nothing pointing at the cause. Reading a field by its
 * short name and *writing* one are one character apart in these files.
 */

const client = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
} as unknown as ApiClient & Record<string, ReturnType<typeof vi.fn>>;

const metadata = new MetadataApi(client);
const instances = new InstancesApi(client);

beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockResolvedValue([]);
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue(undefined);
});

describe('MetadataApi — field definitions', () => {
  it('lists every field', async () => {
    client.get.mockResolvedValue([{ shortName: 'email' }]);

    await expect(metadata.getFields()).resolves.toEqual([{ shortName: 'email' }]);
    expect(client.get).toHaveBeenCalledWith('/api/metadata/fields');
  });

  it('reads one field by its short name', async () => {
    await metadata.getField('email');

    expect(client.get).toHaveBeenCalledWith('/api/metadata/fields/email');
  });

  it('creates a field by posting to the collection, not to a name', async () => {
    const field = { shortName: 'email', label: 'Email', datatype: 'string' };

    await metadata.createField(field as never);

    // Posting to /fields/email would create nothing and 404 silently.
    expect(client.post).toHaveBeenCalledWith('/api/metadata/fields', field);
  });

  it('updates a field in place, addressed by short name', async () => {
    await metadata.updateField('email', { label: 'Email address' });

    expect(client.put).toHaveBeenCalledWith('/api/metadata/fields/email', {
      label: 'Email address',
    });
  });

  it('deletes the field it was asked for', async () => {
    await metadata.deleteField('email');

    expect(client.delete).toHaveBeenCalledWith('/api/metadata/fields/email');
  });

  it('passes a short name through as given, without inventing encoding', async () => {
    await metadata.getField('member_number');

    expect(client.get).toHaveBeenCalledWith('/api/metadata/fields/member_number');
  });
});

describe('MetadataApi — object definitions', () => {
  it('lists every object', async () => {
    await metadata.getObjects();

    expect(client.get).toHaveBeenCalledWith('/api/metadata/objects');
  });

  it('reads one object by its short name', async () => {
    await metadata.getObject('member');

    expect(client.get).toHaveBeenCalledWith('/api/metadata/objects/member');
  });

  it('creates an object', async () => {
    const object = { shortName: 'member', label: 'Member', fields: [] };

    await metadata.createObject(object as never);

    expect(client.post).toHaveBeenCalledWith('/api/metadata/objects', object);
  });

  it('updates an object', async () => {
    await metadata.updateObject('member', { label: 'Club Member' });

    expect(client.put).toHaveBeenCalledWith('/api/metadata/objects/member', {
      label: 'Club Member',
    });
  });

  it('deletes an object', async () => {
    await metadata.deleteObject('member');

    expect(client.delete).toHaveBeenCalledWith('/api/metadata/objects/member');
  });

  it('keeps objects and fields on separate paths', async () => {
    await metadata.getObject('member');
    await metadata.getField('member');

    // Same name, different thing — mixing the two returns the wrong definition.
    expect(client.get).toHaveBeenNthCalledWith(1, '/api/metadata/objects/member');
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/metadata/fields/member');
  });

  it('surfaces a failure rather than swallowing it', async () => {
    client.get.mockRejectedValue(new Error('502'));

    await expect(metadata.getObjects()).rejects.toThrow('502');
  });
});

describe('InstancesApi', () => {
  it('lists instances of one object type', async () => {
    client.get.mockResolvedValue({ data: [], pagination: { page: 1 } });

    await instances.listInstances('member');

    expect(client.get).toHaveBeenCalledWith('/api/objects/member/instances', {
      params: undefined,
    });
  });

  it('passes paging, sorting and search to the server rather than filtering locally', async () => {
    client.get.mockResolvedValue({ data: [], pagination: {} });
    const params = { page: 2, pageSize: 50, sortBy: 'surname', sortOrder: 'asc' as const, search: 'byrne' };

    await instances.listInstances('member', params);

    // Filtering a page of 50 in the browser silently hides the other 4,000.
    expect(client.get).toHaveBeenCalledWith('/api/objects/member/instances', { params });
  });

  it('reads one instance by id', async () => {
    await instances.getInstance('member', 'inst-1');

    expect(client.get).toHaveBeenCalledWith('/api/objects/member/instances/inst-1');
  });

  it('creates an instance under its object type', async () => {
    await instances.createInstance('member', { surname: 'Byrne' });

    expect(client.post).toHaveBeenCalledWith('/api/objects/member/instances', {
      surname: 'Byrne',
    });
  });

  it('updates an instance by id', async () => {
    await instances.updateInstance('member', 'inst-1', { surname: 'Byrne' });

    expect(client.put).toHaveBeenCalledWith('/api/objects/member/instances/inst-1', {
      surname: 'Byrne',
    });
  });

  it('deletes an instance by id', async () => {
    await instances.deleteInstance('member', 'inst-1');

    expect(client.delete).toHaveBeenCalledWith('/api/objects/member/instances/inst-1');
  });

  it('keeps each object type in its own collection', async () => {
    await instances.getInstance('member', 'inst-1');
    await instances.getInstance('event', 'inst-1');

    // Ids are only unique within a type; crossing them returns another club's row.
    expect(client.get).toHaveBeenNthCalledWith(1, '/api/objects/member/instances/inst-1');
    expect(client.get).toHaveBeenNthCalledWith(2, '/api/objects/event/instances/inst-1');
  });
});
