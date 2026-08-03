// Custom Supabase Client Mock routing to local Node.js + MySQL backend
const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL)
  || 'http://localhost:5000/api';


class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.selectColumns = '*';
    this.filters = [];
    this.limitCount = null;
    this.orderObj = null;
    this.rangeObj = null;
    this.payloadData = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
  }

  select(columns = '*', options = {}) {
    if (this.action === 'insert' || this.action === 'update' || this.action === 'upsert' || this.action === 'delete') {
      this.selectColumns = columns;
      return this;
    }
    this.action = 'select';
    this.selectColumns = columns;
    this.isCountOnly = options.count === 'exact' && options.head === true;
    return this;
  }

  insert(data) {
    this.action = 'insert';
    this.payloadData = data;
    return this;
  }

  update(data) {
    this.action = 'update';
    this.payloadData = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(data, options = {}) {
    this.action = 'upsert';
    this.payloadData = data;
    this.onConflict = options.onConflict;
    return this;
  }

  eq(column, value) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  gte(column, value) {
    this.filters.push({ type: 'gte', column, value });
    return this;
  }

  lt(column, value) {
    this.filters.push({ type: 'lt', column, value });
    return this;
  }

  not(column, operator, value) {
    this.filters.push({ type: 'not', column, operator, value });
    return this;
  }

  in(column, values) {
    this.filters.push({ type: 'in', column, value: values });
    return this;
  }

  or(filterString) {
    this.filters.push({ type: 'or', value: filterString });
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderObj = { column, ascending };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  range(from, to) {
    this.rangeObj = { from, to };
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

function fixImageUrl(url, defaultFolder = 'members') {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('data:image/')) return url;
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('/uploads/') || url.startsWith('uploads/')) {
    const filename = url.split('/').pop();
    const folder = (filename.toLowerCase().includes('event') || defaultFolder === 'events') ? 'events' : 'members';
    return `https://gravity-innovations.com/itlc/${folder}/${filename}`;
  }
  return url;
}

function processRowImageUrls(row) {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(processRowImageUrls);
  
  const cleaned = { ...row };
  if (cleaned.profile_image) cleaned.profile_image = fixImageUrl(cleaned.profile_image, 'members');
  if (cleaned.guest_profile_image) cleaned.guest_profile_image = fixImageUrl(cleaned.guest_profile_image, 'members');
  if (cleaned.image) cleaned.image = fixImageUrl(cleaned.image, 'events');
  if (cleaned.poster_template) cleaned.poster_template = fixImageUrl(cleaned.poster_template, 'events');
  
  for (const key of Object.keys(cleaned)) {
    if (cleaned[key] && typeof cleaned[key] === 'object') {
      cleaned[key] = processRowImageUrls(cleaned[key]);
    }
  }
  return cleaned;
}

  // Thenable interface makes it behave exactly like a Promise when awaited
  async then(onfulfilled, onrejected) {
    try {
      let result = await this.execute();
      if (this.isCountOnly) {
        // Return count just like Supabase does: { data: null, count: N, error: null }
        return onfulfilled({ data: null, count: result, error: null });
      }
      if ((this.isSingle || this.isMaybeSingle) && Array.isArray(result)) {
        result = result[0] || null;
      }
      result = processRowImageUrls(result);
      return onfulfilled({ data: result, error: null });
    } catch (error) {
      console.error(`Database Query Error on table ${this.table}:`, error);
      return onfulfilled({ data: null, error });
    }
  }

  async execute() {
    const response = await fetch(`${API_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        table: this.table,
        action: this.action,
        select: this.selectColumns,
        filters: this.filters,
        limit: this.limitCount,
        order: this.orderObj,
        range: this.rangeObj,
        data: this.payloadData,
        single: this.isSingle,
        maybeSingle: this.isMaybeSingle,
        countOnly: this.isCountOnly
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Query failed');
    }

    return await response.json();
  }
}

// Storage Mock Client
const storageMock = {
  from: (bucket) => ({
    upload: async (filePath, file, options = {}) => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_URL}/storage/upload`, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const err = await response.json();
          return { data: null, error: new Error(err.error || 'Upload failed') };
        }
        
        const data = await response.json();
        return { data, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    getPublicUrl: (filePath) => {
      // Extract filename from filepath: member-photos/filename.jpg -> filename.jpg
      const filename = filePath.split('/').pop();
      const folder = filename.toLowerCase().includes('event') ? 'events' : 'members';
      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      const publicUrl = isLocal 
        ? `${API_URL.replace('/api', '')}/uploads/${filename}`
        : `https://gravity-innovations.com/itlc/${folder}/${filename}`;
      return {
        data: {
          publicUrl
        }
      };
    }
  })
};

// Edge Functions Mock Client
const functionsMock = {
  invoke: async (functionName, { body } = {}) => {
    try {
      const response = await fetch(`${API_URL}/functions/${functionName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok) {
        return { data: null, error: new Error(data.message || data.error || 'Function error') };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
};

// Auth Mock Client
const authMock = {
  getSession: async () => {
    const localUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (localUser) {
      return {
        data: {
          session: {
            user: {
              email: localUser.username,
              role: localUser.role
            }
          }
        },
        error: null
      };
    }
    return { data: { session: null }, error: null };
  }
};

export const supabase = {
  from: (table) => new QueryBuilder(table),
  storage: storageMock,
  functions: functionsMock,
  auth: authMock
};
