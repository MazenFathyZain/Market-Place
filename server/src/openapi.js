const bearer = [{ bearerAuth: [] }];
const json = (schema) => ({ content: { 'application/json': { schema } } });
const body = (schema) => ({ required: true, ...json(schema) });
const object = (properties, required = []) => ({ type: 'object', properties, required });
const str = { type: 'string' },
  num = { type: 'integer' };
const listingInput = object(
  {
    title: str,
    author: str,
    description: str,
    item_type: {
      type: 'string',
      enum: ['book', 'newspaper', 'magazine', 'manuscript', 'rare', 'other'],
    },
    item_condition: { type: 'string', enum: ['new', 'excellent', 'good', 'fair'] },
    publication_year: num,
    price: { type: 'integer', description: 'Price in Egyptian pounds' },
    quantity: num,
    image_url: str,
  },
  ['title', 'item_type', 'item_condition', 'price', 'quantity'],
);
const id = { name: 'id', in: 'path', required: true, schema: num };
const response = (description) => ({ description });
export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'متجر علم Marketplace API',
    version: '1.0.0',
    description:
      'Books, newspapers, magazines, manuscripts and rare items. Seller listings require admin approval before becoming public. Orders are cash on delivery / manual fulfilment.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Profile: object({
        id: num,
        name: str,
        email: str,
        role: { type: 'string', enum: ['customer', 'seller', 'admin'] },
        phone: str,
        city: str,
        address: str,
        store_name: str,
        bio: str,
        created_at: str,
      }),
      Listing: object({
        id: num,
        title: str,
        author: str,
        description: str,
        item_type: str,
        item_condition: str,
        publication_year: num,
        price: num,
        quantity: num,
        image_url: str,
        status: str,
        seller_id: num,
        seller_name: str,
      }),
      Order: object({
        id: num,
        buyer_id: num,
        total: num,
        status: str,
        customer_name: str,
        phone: str,
        address: str,
        city: str,
        items: {
          type: 'array',
          items: object({
            seller_id: num,
            seller_name: str,
            title: str,
            unit_price: num,
            quantity: num,
          }),
        },
      }),
    },
  },
  paths: {
    '/health': {
      get: { tags: ['System'], summary: 'Health check', responses: { 200: response('Healthy') } },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register customer or seller',
        requestBody: body(
          object(
            {
              name: str,
              email: str,
              password: str,
              role: { type: 'string', enum: ['customer', 'seller'] },
            },
            ['name', 'email', 'password'],
          ),
        ),
        responses: {
          201: response('Created'),
          400: response('Invalid input'),
          409: response('Email in use'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        requestBody: body(object({ email: str, password: str }, ['email', 'password'])),
        responses: { 200: response('User and JWT'), 401: response('Invalid credentials') },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user',
        security: bearer,
        responses: { 200: response('User'), 401: response('Unauthorized') },
      },
    },
    '/auth/become-seller': {
      post: {
        tags: ['Auth'],
        summary: 'Upgrade an existing customer account to seller',
        security: bearer,
        responses: { 200: response('Updated user') },
      },
    },
    '/profile': {
      get: {
        tags: ['Profile'],
        summary: 'Get my account, delivery and store details',
        security: bearer,
        responses: { 200: response('Profile') },
      },
      put: {
        tags: ['Profile'],
        summary: 'Update my profile; role cannot be changed here',
        security: bearer,
        requestBody: body(
          object(
            {
              name: str,
              email: str,
              phone: str,
              city: str,
              address: str,
              store_name: str,
              bio: str,
            },
            ['name', 'email'],
          ),
        ),
        responses: { 200: response('Updated profile'), 409: response('Email already used') },
      },
    },
    '/profile/password': {
      put: {
        tags: ['Profile'],
        summary: 'Change password using the current password',
        security: bearer,
        requestBody: body(
          object({ current_password: str, new_password: str }, [
            'current_password',
            'new_password',
          ]),
        ),
        responses: {
          204: response('Password changed'),
          400: response('Current password incorrect'),
        },
      },
    },
    '/listings': {
      get: {
        tags: ['Catalog'],
        summary: 'Approved in-stock listings only',
        parameters: [
          { name: 'q', in: 'query', schema: str },
          { name: 'type', in: 'query', schema: str },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['newest', 'price_asc', 'price_desc'] },
          },
          { name: 'page', in: 'query', schema: num },
        ],
        responses: { 200: response('Paginated listings') },
      },
    },
    '/listings/{id}': {
      get: {
        tags: ['Catalog'],
        summary: 'Approved listing details',
        parameters: [id],
        responses: { 200: response('Listing'), 404: response('Not found') },
      },
    },
    '/uploads': {
      post: {
        tags: ['Seller'],
        summary: 'Upload a JPG, PNG or WebP image (max 5 MB)',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: object({ image: { type: 'string', format: 'binary' } }, ['image']),
            },
          },
        },
        responses: { 201: response('Image URL') },
      },
    },
    '/seller/listings': {
      get: {
        tags: ['Seller'],
        summary: 'My listings, all approval states',
        security: bearer,
        responses: { 200: response('Listings') },
      },
      post: {
        tags: ['Seller'],
        summary: 'Submit listing for review; admin listings are approved immediately',
        security: bearer,
        requestBody: body(listingInput),
        responses: { 201: response('Created listing') },
      },
    },
    '/seller/listings/{id}': {
      put: {
        tags: ['Seller'],
        summary: 'Edit own listing; seller edits return it to review',
        security: bearer,
        parameters: [id],
        requestBody: body(listingInput),
        responses: { 200: response('Updated listing') },
      },
      delete: {
        tags: ['Seller'],
        summary: 'Delete own listing if it has no orders',
        security: bearer,
        parameters: [id],
        responses: { 204: response('Deleted'), 409: response('Linked to an order') },
      },
    },
    '/admin/listings': {
      get: {
        tags: ['Admin'],
        summary: 'Review queue and all listings',
        security: bearer,
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          },
        ],
        responses: { 200: response('Listings') },
      },
    },
    '/admin/listings/{id}/review': {
      patch: {
        tags: ['Admin'],
        summary: 'Approve or reject a listing',
        security: bearer,
        parameters: [id],
        requestBody: body(
          object({ status: { type: 'string', enum: ['approved', 'rejected'] }, note: str }, [
            'status',
          ]),
        ),
        responses: { 200: response('Reviewed listing') },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Place one order per seller; stock is reserved immediately',
        security: bearer,
        requestBody: body(
          object(
            {
              customer_name: str,
              phone: str,
              address: str,
              city: str,
              notes: str,
              items: {
                type: 'array',
                items: object({ listing_id: num, quantity: num }, ['listing_id', 'quantity']),
              },
            },
            ['customer_name', 'phone', 'address', 'city', 'items'],
          ),
        ),
        responses: {
          201: {
            description: 'Created separate orders per seller',
            content: {
              'application/json': {
                schema: object({
                  order: { $ref: '#/components/schemas/Order' },
                  orders: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
                }),
              },
            },
          },
          409: response('Insufficient stock'),
        },
      },
    },
    '/orders/mine': {
      get: {
        tags: ['Orders'],
        summary: 'My purchases',
        security: bearer,
        responses: { 200: response('Orders') },
      },
    },
    '/seller/orders': {
      get: {
        tags: ['Seller'],
        summary: 'Items ordered from my listings',
        security: bearer,
        responses: { 200: response('Order items') },
      },
    },
    '/admin/orders': {
      get: {
        tags: ['Admin'],
        summary: 'All orders',
        security: bearer,
        responses: { 200: response('Orders') },
      },
    },
    '/admin/orders/{id}': {
      patch: {
        tags: ['Admin'],
        summary: 'Update fulfilment state; cancellation restores stock',
        security: bearer,
        parameters: [id],
        requestBody: body(
          object(
            {
              status: {
                type: 'string',
                enum: ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'],
              },
            },
            ['status'],
          ),
        ),
        responses: { 200: response('Updated order') },
      },
    },
  },
};
