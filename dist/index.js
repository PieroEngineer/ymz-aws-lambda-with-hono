// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler2;
      if (middleware[i]) {
        handler2 = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler2 = i === middleware.length && next || void 0;
      }
      if (handler2) {
        try {
          res = await handler2(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/body.js
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = request instanceof HonoRequest ? request.raw.headers : request.headers;
  const contentType = headers.get("Content-Type");
  if (contentType?.startsWith("multipart/form-data") || contentType?.startsWith("application/x-www-form-urlencoded")) {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const formData = await request.formData();
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler2) => {
          this.#addRoute(method, this.#path, handler2);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler2) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler2);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler2) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler2);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler2;
      if (app2.errorHandler === errorHandler) {
        handler2 = r.handler;
      } else {
        handler2 = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler2[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler2, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler2) => {
    this.errorHandler = handler2;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler2) => {
    this.#notFoundHandler = handler2;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler2 = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler2);
    return this;
  }
  #addRoute(method, path, handler2, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler: handler2
    };
    this.router.add(method, path, [handler2, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler2) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler2, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler2, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler2, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler2) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler2]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler2, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler2) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler: handler2, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler2) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler: handler2,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler: handler2, params }) => [handler2, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler2) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler2);
      }
      return;
    }
    this.#node.insert(method, path, handler2);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        if (opts.credentials) {
          return (origin) => origin || null;
        }
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*" || opts.credentials) {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*" || opts.credentials) {
      c.header("Vary", "Origin", { append: true });
    }
  };
};

// node_modules/hono/dist/utils/encode.js
var encodeBase64 = (buf) => {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0, len = bytes.length; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};
var decodeBase64 = (str) => {
  const binary = atob(str);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  const half = binary.length / 2;
  for (let i = 0, j = binary.length - 1; i <= half; i++, j--) {
    bytes[i] = binary.charCodeAt(i);
    bytes[j] = binary.charCodeAt(j);
  }
  return bytes;
};

// node_modules/hono/dist/adapter/aws-lambda/handler.js
function sanitizeHeaderValue(value) {
  const hasNonAscii = /[^\x00-\x7F]/.test(value);
  if (!hasNonAscii) {
    return value;
  }
  return encodeURIComponent(value);
}
var getRequestContext = (event) => {
  return event.requestContext;
};
var handle = (app2, { isContentTypeBinary } = { isContentTypeBinary: void 0 }) => {
  return async (event, lambdaContext) => {
    const processor = getProcessor(event);
    let req, requestContext;
    try {
      req = processor.createRequest(event);
      requestContext = getRequestContext(event);
    } catch (error) {
      console.error("Error processing request:", error);
      const errorResponse = error instanceof TypeError ? new Response("Invalid request", { status: 400 }) : new Response("Internal Server Error", { status: 500 });
      return processor.createResult(event, errorResponse, { isContentTypeBinary });
    }
    const res = await app2.fetch(req, {
      event,
      requestContext,
      lambdaContext
    });
    return processor.createResult(event, res, { isContentTypeBinary });
  };
};
var EventProcessor = class {
  getHeaderValue(headers, key) {
    const value = headers ? Array.isArray(headers[key]) ? headers[key][0] : headers[key] : void 0;
    return value;
  }
  getDomainName(event) {
    if (event.requestContext && "domainName" in event.requestContext) {
      return event.requestContext.domainName;
    }
    const hostFromHeaders = this.getHeaderValue(event.headers, "host");
    if (hostFromHeaders) {
      return hostFromHeaders;
    }
    const multiValueHeaders = "multiValueHeaders" in event ? event.multiValueHeaders : {};
    const hostFromMultiValueHeaders = this.getHeaderValue(multiValueHeaders, "host");
    return hostFromMultiValueHeaders;
  }
  createRequest(event) {
    const queryString = this.getQueryString(event);
    const domainName = this.getDomainName(event);
    const path = this.getPath(event);
    const urlPath = `https://${domainName}${path}`;
    const url = queryString ? `${urlPath}?${queryString}` : urlPath;
    const headers = this.getHeaders(event);
    const method = this.getMethod(event);
    const requestInit = {
      headers,
      method
    };
    if (event.body) {
      requestInit.body = event.isBase64Encoded ? decodeBase64(event.body) : event.body;
    }
    return new Request(url, requestInit);
  }
  async createResult(event, res, options) {
    const contentType = res.headers.get("content-type");
    const isContentTypeBinary = options.isContentTypeBinary ?? defaultIsContentTypeBinary;
    let isBase64Encoded = contentType && isContentTypeBinary(contentType) ? true : false;
    if (!isBase64Encoded) {
      const contentEncoding = res.headers.get("content-encoding");
      isBase64Encoded = isContentEncodingBinary(contentEncoding);
    }
    const body = isBase64Encoded ? encodeBase64(await res.arrayBuffer()) : await res.text();
    const result = {
      body,
      statusCode: res.status,
      isBase64Encoded,
      ..."multiValueHeaders" in event && event.multiValueHeaders ? {
        multiValueHeaders: {}
      } : {
        headers: {}
      }
    };
    this.setCookies(event, res, result);
    if (result.multiValueHeaders) {
      res.headers.forEach((value, key) => {
        result.multiValueHeaders[key] = [value];
      });
    } else {
      res.headers.forEach((value, key) => {
        result.headers[key] = value;
      });
    }
    return result;
  }
  setCookies(_event, res, result) {
    if (res.headers.has("set-cookie")) {
      const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : Array.from(res.headers.entries()).filter(([k]) => k === "set-cookie").map(([, v]) => v);
      if (Array.isArray(cookies)) {
        this.setCookiesToResult(result, cookies);
        res.headers.delete("set-cookie");
      }
    }
  }
};
var EventV2Processor = class extends EventProcessor {
  getPath(event) {
    return event.rawPath;
  }
  getMethod(event) {
    return event.requestContext.http.method;
  }
  getQueryString(event) {
    return event.rawQueryString;
  }
  getCookies(event, headers) {
    if (Array.isArray(event.cookies)) {
      headers.set("Cookie", event.cookies.join("; "));
    }
  }
  setCookiesToResult(result, cookies) {
    result.cookies = cookies;
  }
  getHeaders(event) {
    const headers = new Headers();
    this.getCookies(event, headers);
    if (event.headers) {
      for (const [k, v] of Object.entries(event.headers)) {
        if (v) {
          headers.set(k, v);
        }
      }
    }
    return headers;
  }
};
var v2Processor = new EventV2Processor();
var EventV1Processor = class extends EventProcessor {
  getPath(event) {
    return event.path;
  }
  getMethod(event) {
    return event.httpMethod;
  }
  getQueryString(event) {
    if (event.multiValueQueryStringParameters) {
      return Object.entries(event.multiValueQueryStringParameters || {}).filter(([, value]) => value).map(
        ([key, values]) => values.map((value) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
      ).join("&");
    } else {
      return Object.entries(event.queryStringParameters || {}).filter(([, value]) => value).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value || "")}`).join("&");
    }
  }
  getCookies(_event, _headers) {
  }
  getHeaders(event) {
    const headers = new Headers();
    this.getCookies(event, headers);
    if (event.headers) {
      for (const [k, v] of Object.entries(event.headers)) {
        if (v) {
          headers.set(k, sanitizeHeaderValue(v));
        }
      }
    }
    if (event.multiValueHeaders) {
      for (const [k, values] of Object.entries(event.multiValueHeaders)) {
        if (values) {
          const foundK = headers.get(k);
          values.forEach((v) => {
            const sanitizedValue = sanitizeHeaderValue(v);
            return (!foundK || !foundK.includes(sanitizedValue)) && headers.append(k, sanitizedValue);
          });
        }
      }
    }
    return headers;
  }
  setCookiesToResult(result, cookies) {
    result.multiValueHeaders = {
      "set-cookie": cookies
    };
  }
};
var v1Processor = new EventV1Processor();
var ALBProcessor = class extends EventProcessor {
  getHeaders(event) {
    const headers = new Headers();
    if (event.multiValueHeaders) {
      for (const [key, values] of Object.entries(event.multiValueHeaders)) {
        if (values && Array.isArray(values)) {
          const sanitizedValue = sanitizeHeaderValue(values.join("; "));
          headers.set(key, sanitizedValue);
        }
      }
    } else {
      for (const [key, value] of Object.entries(event.headers ?? {})) {
        if (value) {
          headers.set(key, sanitizeHeaderValue(value));
        }
      }
    }
    return headers;
  }
  getPath(event) {
    return event.path;
  }
  getMethod(event) {
    return event.httpMethod;
  }
  getQueryString(event) {
    if (event.multiValueQueryStringParameters) {
      return Object.entries(event.multiValueQueryStringParameters || {}).filter(([, value]) => value).map(([key, value]) => `${key}=${value.join(`&${key}=`)}`).join("&");
    } else {
      return Object.entries(event.queryStringParameters || {}).filter(([, value]) => value).map(([key, value]) => `${key}=${value}`).join("&");
    }
  }
  getCookies(event, headers) {
    let cookie;
    if (event.multiValueHeaders) {
      cookie = event.multiValueHeaders["cookie"]?.join("; ");
    } else {
      cookie = event.headers ? event.headers["cookie"] : void 0;
    }
    if (cookie) {
      headers.append("Cookie", cookie);
    }
  }
  setCookiesToResult(result, cookies) {
    if (result.multiValueHeaders) {
      result.multiValueHeaders["set-cookie"] = cookies;
    } else {
      result.headers["set-cookie"] = cookies.join(", ");
    }
  }
};
var albProcessor = new ALBProcessor();
var LatticeV2Processor = class extends EventProcessor {
  getPath(event) {
    return event.path;
  }
  getMethod(event) {
    return event.method;
  }
  getQueryString() {
    return "";
  }
  getHeaders(event) {
    const headers = new Headers();
    if (event.headers) {
      for (const [k, values] of Object.entries(event.headers)) {
        if (values) {
          const foundK = headers.get(k);
          values.forEach((v) => {
            const sanitizedValue = sanitizeHeaderValue(v);
            return (!foundK || !foundK.includes(sanitizedValue)) && headers.append(k, sanitizedValue);
          });
        }
      }
    }
    return headers;
  }
  getCookies() {
  }
  setCookiesToResult(result, cookies) {
    result.headers = {
      ...result.headers,
      "set-cookie": cookies.join(", ")
    };
  }
};
var latticeV2Processor = new LatticeV2Processor();
var getProcessor = (event) => {
  if (isProxyEventALB(event)) {
    return albProcessor;
  }
  if (isProxyEventV2(event)) {
    return v2Processor;
  }
  if (isLatticeEventV2(event)) {
    return latticeV2Processor;
  }
  return v1Processor;
};
var isProxyEventALB = (event) => {
  if (event.requestContext) {
    return Object.hasOwn(event.requestContext, "elb");
  }
  return false;
};
var isProxyEventV2 = (event) => {
  return Object.hasOwn(event, "rawPath");
};
var isLatticeEventV2 = (event) => {
  if (event.requestContext) {
    return Object.hasOwn(event.requestContext, "serviceArn");
  }
  return false;
};
var defaultIsContentTypeBinary = (contentType) => {
  return !/^text\/(?:plain|html|css|javascript|csv)|(?:\/|\+)(?:json|xml)\s*(?:;|$)/.test(
    contentType
  );
};
var isContentEncodingBinary = (contentEncoding) => {
  if (contentEncoding === null) {
    return false;
  }
  return /^(gzip|deflate|compress|br)/.test(contentEncoding);
};

// src/k.ts
var ablyKeyWS = "4w64MA.R_FXWQ:2BlLaKwCQu5o2R6EoCt9RwNcoGNHIxOWs9pPFodpMhQ";
var TABLE_NAME = "YummiziTable";
var GSI_TABLE_NAME = "YummiziGsiTable";
var BUCKET_NAME = "restaurant-assets";

// src/clients/ablyClient.ts
async function transmitViaAbly(channelName, eventName, dataPayload, maxAttempts = 3) {
  if (!ablyKeyWS) {
    throw new Error("ABLY_API_KEY is not defined");
  }
  const [username, password] = ablyKeyWS.split(":");
  const credentials = btoa(`${username}:${password}`);
  const ablyEndpoint = `https://rest.ably.io/channels/${channelName}/messages`;
  let ablyDispatchSuccess = false;
  let attempts = 0;
  while (!ablyDispatchSuccess && attempts < maxAttempts) {
    try {
      attempts++;
      const ablyResponse = await fetch(ablyEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: eventName,
          // The targeted subscriber frequency path matching mock constraints
          data: dataPayload
          // The exact TableRequestPayload DTO shape your staff app consumes
        })
      });
      if (ablyResponse.ok) {
        ablyDispatchSuccess = true;
        console.log(`\u{1F4E1} [Attempt ${attempts}] Successfully order preselection event to Ably channel: ${channelName}`);
        console.log(`\u{1F4E6}  Order to send: ${JSON.stringify({ name: eventName, data: dataPayload }, null, 2)}`);
      } else {
        console.warn(`\u26A0\uFE0F [Attempt ${attempts}] Mock Ably returned a status error code: ${ablyResponse.status}`);
      }
    } catch (netErr) {
      console.warn(`\u26A0\uFE0F [Attempt ${attempts}] Network failure transmitting data payload to mock Ably server: ${netErr.message}`);
    }
  }
  if (!ablyDispatchSuccess) {
    console.error(`\u{1F6A8} CRITICAL: Failed to stream real-time broadcast alert data past ${maxAttempts} attempts. Database state remains fully valid.`);
  }
  return ablyDispatchSuccess;
}

// src/repositories/requestRepository.ts
import { BatchGetCommand, DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// src/docClient.ts
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// src/aws/clientFactory.ts
import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
var isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
var awsRegion = process.env.AWS_REGION || "us-east-1";
var localstackUrl = "http://localhost:4566";
var getS3Client = () => {
  if (isLocal) {
    return new S3Client({
      endpoint: localstackUrl,
      region: awsRegion,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test"
      },
      // ⚠️ CRITICAL: LocalStack relies on path-style routing for local S3 buckets
      forcePathStyle: true
    });
  }
  return new S3Client({ region: awsRegion });
};
var getDynamoDBClient = () => {
  if (isLocal) {
    return new DynamoDBClient({
      endpoint: localstackUrl,
      region: awsRegion,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test"
      }
    });
  }
  return new DynamoDBClient({ region: awsRegion });
};

// src/docClient.ts
var rawDynamo = getDynamoDBClient();
var docClient = DynamoDBDocumentClient.from(rawDynamo, {
  marshallOptions: { removeUndefinedValues: true }
});

// src/repositories/requestRepository.ts
async function putRequest(restaurantId, requestId, requestData) {
  const newRequestItem = {
    PK: `REST#${restaurantId}`,
    SK: `REQ#${requestId}`,
    ...requestData
  };
  console.log("\u{1F4BD}  Request Item to save in DynamoDB", JSON.stringify(newRequestItem, null, 2), "\nfor restaurant ", restaurantId);
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: newRequestItem
  }));
}
async function deleteRequest(restaurantId, requestId) {
  const pk = `REST#${restaurantId}`;
  const sk = `REQ#${requestId}`;
  await docClient.send(new DeleteCommand({
    // TODO: This is temporal  code and should be alternated with the commented code that is just above
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk }
  }));
}
async function queryRequestsByRestaurant(restaurantId) {
  const queryParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `REST#${restaurantId}`,
      ":skPrefix": "REQ#"
    }
  };
  const dbResult = await docClient.send(new QueryCommand(queryParams));
  return dbResult.Items || [];
}
async function updateRequestState(restaurantId, requestId, normalizedState) {
  const pk = `REST#${restaurantId}`;
  const sk = `REQ#${requestId}`;
  await docClient.send(new UpdateCommand({
    // TODO: Include the updating of the acceptance's timestamp too
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: "SET #state = :state",
    ExpressionAttributeNames: {
      "#state": "state"
    },
    ExpressionAttributeValues: {
      ":state": normalizedState
    }
  }));
}
async function batchGetRequests(requestsToUpdate) {
  const formattedKeys = requestsToUpdate.map((item) => ({
    PK: `REST#${item.restaurantId}`,
    SK: `REQ#${item.requestId}`
  }));
  const batchResponse = await docClient.send(new BatchGetCommand({
    RequestItems: {
      [TABLE_NAME]: {
        Keys: formattedKeys,
        ConsistentRead: false
        // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB)
      }
    }
  }));
  return batchResponse.Responses?.[TABLE_NAME] || [];
}

// src/services/requestService.ts
async function saveRequest(requestPayload) {
  const requestTime = Date.now();
  const mockUserSpecifics = ["special day", "with vehicule"];
  const baseRequestInfo = {
    userId: requestPayload.userId,
    userName: requestPayload.userName,
    groupSize: requestPayload.groupSize,
    onQueuedTimestamp: requestTime,
    state: "QUEUED",
    specifics: mockUserSpecifics,
    arrivlaTime: requestPayload.arrivalTime
  };
  await putRequest(requestPayload.restaurantId, requestPayload.requestId, baseRequestInfo);
  return baseRequestInfo;
}
async function transmitTableRequest(restaurantId, clientPayload) {
  const channelName = `restaurant:${restaurantId}:ops`;
  const requestName = "table-requested";
  return await transmitViaAbly(channelName, requestName, clientPayload);
}
async function cancelRequest(restaurantId, requestId) {
  await deleteRequest(restaurantId, requestId);
}
async function transmitRequestCancellation(cancelPayload, requestId) {
  const clientPayload = {
    requestId
  };
  let channelName;
  switch (cancelPayload.actor) {
    case "RESTAURANT":
      channelName = `request:${cancelPayload.userId}`;
    case "USER":
      channelName = `restaurant:${cancelPayload.restaurantId}:ops`;
  }
  const requestName = "request-canceled";
  return await transmitViaAbly(channelName, requestName, clientPayload);
}
async function obtainRestaurantRequests(restaurantId) {
  const rawItems = await queryRequestsByRestaurant(restaurantId);
  console.log(`\u{1F50D} Raw data to respond the GET request 
${JSON.stringify(rawItems)} 
For Restaurant: ${restaurantId}`);
  const mappedPayloads = rawItems.map((item) => {
    const requestId = item.SK.replace("REQ#", "");
    return {
      requestId,
      userId: item.userId,
      userName: item.userName,
      groupSize: item.groupSize,
      onQueuedTimestamp: item.onQueuedTimestamp,
      state: item.state,
      specifics: item.specifics,
      arrivlaTime: item.arrivlaTime
      // TODO: Correct the name "arrivalTimeInMinunes"
    };
  });
  console.log(`1\uFE0F\u20E3\u{1F4E6}  Initialized UI state feed: Found 
${JSON.stringify(mappedPayloads)} 
For Restaurant: ${restaurantId}`);
  return mappedPayloads;
}
async function updateRequestStatus(restaurantId, updatePayload) {
  const normalizedState = String(updatePayload.newState);
  await updateRequestState(restaurantId, updatePayload.requestId, normalizedState);
  let channelName;
  switch (normalizedState) {
    case "ACCEPTED":
      channelName = `request:${updatePayload.userId}`;
      break;
    case "READY":
    // When the user notifies that they want to go to the restaurant
    case "PAY_TRIED":
      channelName = `restaurant:${restaurantId}:ops`;
      break;
  }
  let realtimeNotified = false;
  if (ablyKeyWS) {
    console.log(`1\uFE0F\u20E3\u{1F4FA}  Channel to emit ${channelName}`);
    const clientPayload = {
      requestId: updatePayload.requestId,
      newStatus: normalizedState
    };
    realtimeNotified = await transmitViaAbly(
      channelName,
      "request-status-updated",
      /// Consider change Message's name by a code for security 
      clientPayload,
      1
    );
    if (!realtimeNotified) {
      console.warn(`\u26A0\uFE0F Failed to broadcast request status update to Ably`);
    }
  } else {
    console.warn("\u26A0\uFE0F ABLY_API_KEY is not defined; skipping realtime broadcast.");
  }
  return { normalizedState, realtimeNotified };
}
async function obtainActiveRequestStatuses(requestsToUpdate) {
  const requestItems = await batchGetRequests(requestsToUpdate);
  const mappedPayloads = requestItems.map((item) => {
    const requestId = item.SK.replace("REQ#", "");
    return {
      requestId,
      // restaurantId: restaurantId,
      state: item.state
      // userId: item.userId,
      // //X userName: item.userName,
      // groupSize: item.groupSize,
      // onQueuedTimestamp: item.onQueuedTimestamp,
      // specifics: item.specifics,
      // arrivlaTime: item.arrivlaTime // TODO: Correct the name
    };
  });
  console.log(`1\uFE0F\u20E3\u{1F4E6}  Requested Table requests from the  
${JSON.stringify(mappedPayloads)} 
`);
  return mappedPayloads;
}

// src/routes/requests.ts
var requestsRouter = new Hono2();
requestsRouter.post("/create", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    console.log(`\u{1F50E}\u{1F4E6}  Data arrived from restaurant ${body.restaurantId} 
${JSON.stringify(body)}`);
    if (!body.restaurantId || !body.userId || !body.requestId) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }
    const baseRequestInfo = await saveRequest(body);
    console.log(`\u2705\u{1F4E6}  Request saved in DynamoDB for restaurant ${body.restaurantId} 
${JSON.stringify(baseRequestInfo)}`);
    const clientPayload = {
      requestId: body.requestId,
      ...baseRequestInfo
    };
    const ablyDispatchSuccess = await transmitTableRequest(body.restaurantId, clientPayload);
    console.log(`\u2705\u{1F4E1}  Ably dispatch success: ${ablyDispatchSuccess} for restaurant ${body.restaurantId} 
${JSON.stringify(clientPayload)}`);
    const createRequestResponse = {
      message: "Request created successfully and broadcast state synchronized",
      requestId: body.requestId,
      realtimeNotified: ablyDispatchSuccess
    };
    return c.json(createRequestResponse, 201);
  } catch (error) {
    console.error(`\u{1F6A8} CREATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
requestsRouter.post("/:requestId/cancel", async (c) => {
  try {
    const requestId = c.req.param("requestId");
    const body = await c.req.json().catch(() => ({}));
    console.log(` Body of the cancellation ${JSON.stringify(body, null, 2)}`);
    if (!body.restaurantId) {
      return c.json({ error: "Missing restaurantId" }, 400);
    }
    if (!requestId) {
      return c.json({ error: "Missing requestId" }, 400);
    }
    if (!body.userId) {
      return c.json({ error: "Missing userId" }, 400);
    }
    if (!body.actor) {
      return c.json({ error: "Missing cancellation actor" }, 400);
    }
    await cancelRequest(body.restaurantId, requestId);
    await transmitRequestCancellation(body, requestId);
    return c.json({
      message: "Request cancelled successfully"
      // onCancellationTimestamp: timestamp
    }, 200);
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return c.json({
        error: "The request was already paid and cannot be cancelled"
      }, 403);
    }
    console.error(`\u{1F6A8} CANCEL REQ ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
requestsRouter.get("/:restaurantId", async (c) => {
  try {
    const rid = c.req.param("restaurantId");
    if (!rid) {
      return c.json({ error: "Missing restaurantId parameter" }, 400);
    }
    const mappedPayloads = await obtainRestaurantRequests(rid);
    return c.json(mappedPayloads, 200);
  } catch (error) {
    console.error(`\u{1F6A8} FETCH ACTIVE REQS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
requestsRouter.post("/:restaurantId/update", async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");
    const body = await c.req.json().catch(() => ({}));
    console.log(`1\uFE0F\u20E3\u{1F4E6}  Data arrived from restaurant ${restaurantId} 
${JSON.stringify(body)}`);
    if (!restaurantId || !body.requestId || !body.newState) {
      return c.json({ error: "Missing restaurantId, requestId, or newState" }, 400);
    }
    const { normalizedState, realtimeNotified } = await updateRequestStatus(restaurantId, body);
    console.log(`\u{1F50E}  The post of the request update finished`);
    const updateRequestResponse = {
      message: "Request state updated successfully",
      restaurantId,
      requestId: body.requestId,
      newState: normalizedState,
      realtimeNotified
    };
    return c.json(updateRequestResponse, 200);
  } catch (error) {
    console.error(`\u{1F6A8} UPDATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
requestsRouter.post("/active", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const requestsToUpdate = body.requestsToUpdate;
    const mappedPayloads = await obtainActiveRequestStatuses(requestsToUpdate);
    return c.json({
      statuses: mappedPayloads
    }, 200);
  } catch (error) {
    console.error(`\u{1F6A8} FETCH ACTIVE REQS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// src/clients/s3Client.ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var s3Client = getS3Client();
async function generateS3PresignedUrl(s3Key) {
  const unixEpoch = Math.floor(Date.now() / 1e3);
  const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`;
  const publicUrl = `${s3BaseUrl}/${s3Key}?v=${unixEpoch}`;
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: "image/webp"
      // Enforces binary media type constraints
    }),
    { expiresIn: 900 }
    // URL token token expires safely in 15 minutes
  );
  return {
    publicUrl,
    uploadUrl
  };
}

// src/repositories/paymentRepository.ts
import { BatchGetCommand as BatchGetCommand2, PutCommand as PutCommand2, QueryCommand as QueryCommand2, UpdateCommand as UpdateCommand2 } from "@aws-sdk/lib-dynamodb";
async function getAllActiveOrders(restaurantId) {
  const queryParams = {
    TableName: TABLE_NAME,
    IndexName: GSI_TABLE_NAME,
    KeyConditionExpression: "GSIPK = :pk AND begins_with(GSISK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `REST#${restaurantId}`,
      ":skPrefix": "ORDER#ACTIVE#"
    }
  };
  const dbResult = await docClient.send(new QueryCommand2(queryParams));
  const rawItems = dbResult.Items || [];
  const mappedOrders = rawItems.map((item) => {
    const requestId = item.SK.replace("ORDER#", "");
    const order = {
      requestId,
      userName: item.userName,
      // lastUpdateTimestamp: item.lastUpdateTimestamp,
      userId: item.userId,
      orderSelections: item.orderSelections,
      arrivalTimeInMinutes: item.arrivalTimeInMinutes,
      groupSize: item.groupSize,
      totalCostInCents: item.totalCostInCents,
      onPaidTimeStamp: item.onPaidTimeStamp,
      paymentImageUrl: item.paymentImageUrl
    };
    return order;
  });
  return mappedOrders;
}
async function getSpecificDishesData(orderSelections, restaurantId) {
  const keys = orderSelections.map((selection) => ({
    PK: `REST#${restaurantId}`,
    SK: `RESOURCE#DISH#${selection.dishId}`
  }));
  const response = await docClient.send(new BatchGetCommand2({
    /// Analyze if a transaction is more proper for this situation
    RequestItems: {
      [TABLE_NAME]: {
        Keys: keys,
        ConsistentRead: false,
        // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB)
        ProjectionExpression: "priceCents, SK"
        // Optional: Save bandwidth
      }
    }
  }));
  const dishItems = response.Responses?.[TABLE_NAME] || [];
  const priceMap = [];
  for (let i = 0; i < dishItems.length; i++) {
    const item = dishItems[i];
    const dishId = item.SK.replace("RESOURCE#DISH#", "");
    priceMap.push({
      dishId,
      priceCents: item.priceCents
    });
  }
  return priceMap;
}
async function putConfirmedOrder(confirmationEvent) {
  const { restaurantId, requestId, ...data } = confirmationEvent;
  const newConfirmationEvent = {
    PK: `REST#${restaurantId}`,
    SK: `ORDER#${requestId}`,
    /// Perphaps it should be a new ID, not the request ID
    GSIPK: `REST#${restaurantId}`,
    GSISK: `ORDER#ACTIVE#${requestId}`,
    ...data
  };
  console.log("\u{1F4BD}  Order to save in DynamoDB", JSON.stringify(newConfirmationEvent, null, 2), "\nfor restaurant ", confirmationEvent.restaurantId);
  await docClient.send(new PutCommand2({
    TableName: TABLE_NAME,
    Item: newConfirmationEvent
  }));
}
async function updateOrderToDeactivate(restaurantId, orderId) {
  await docClient.send(new UpdateCommand2({
    TableName: TABLE_NAME,
    Key: {
      PK: `REST#${restaurantId}`,
      SK: `ORDER#${orderId}`
    },
    UpdateExpression: "REMOVE GSIPK, GSISK",
    /* TODO SET #status = :status, completedAt = :ts*/
    ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    ReturnValues: "NONE"
    // ExpressionAttributeNames: { '#status': 'status' },   // TODO: Include Status and datetime of the event
    // ExpressionAttributeValues: { ':status': 'completed', ':ts': now }
  }));
}

// src/services/paymentService.ts
async function saveConfirmedOrder(confirmationEvent) {
  await putConfirmedOrder(confirmationEvent);
}
async function obtainAllActiveOrders(restaurantId) {
  return await getAllActiveOrders(restaurantId);
}
async function finalizeOrder(restaurantId, orderId) {
  await updateOrderToDeactivate(restaurantId, orderId);
}
async function obtainSpecificDishesData(orderSelections, restaurantId) {
  return await getSpecificDishesData(orderSelections, restaurantId);
}
async function obtainPaymentPresignedUrl(s3Key) {
  return await generateS3PresignedUrl(s3Key);
}
async function transmitConfirmationToRestaurant(confirmationEvent) {
  const channelName = `restaurant:${confirmationEvent.restaurantId}:ops`;
  const eventName = "order-confirmed";
  const { restaurantId, ...confirmationEventToTransmit } = confirmationEvent;
  await transmitViaAbly(channelName, eventName, confirmationEventToTransmit);
}
function calculateTotalCost(selectedDishes, dishItems) {
  const numDishItems = dishItems.length;
  const numInputItems = selectedDishes.length;
  const priceMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < numDishItems; i++) {
    const item = dishItems[i];
    if (item.dishId !== void 0 && item.priceCents !== void 0) {
      priceMap.set(item.dishId, item.priceCents);
    }
  }
  let totalCents = 0;
  for (let j = 0; j < numInputItems; j++) {
    const input = selectedDishes[j];
    const price = priceMap.get(input.dishId);
    if (price !== void 0) {
      totalCents += input.quantity * price;
    }
  }
  return totalCents;
}

// src/routes/payments.ts
var paymentsRouter = new Hono2();
paymentsRouter.post("/confirm", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    if (!body.restaurantId || !body.userId || !body.requestId) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }
    const dishItems = await obtainSpecificDishesData(body.orderSelections, body.restaurantId);
    console.log(`\u2705  Retrieved specific dish data for restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`);
    const totalCostInCents = calculateTotalCost(body.orderSelections, dishItems);
    console.log(`\u2705  Total cost calculated for restaurantId: ${body.restaurantId}, requestId: ${body.requestId} is ${totalCostInCents} cents`);
    const s3Key = `payments/${body.restaurantId}/${body.requestId}.webp`;
    const paymentImageReferences = await obtainPaymentPresignedUrl(s3Key);
    console.log(`\u2705  Obtained presigned URLs for restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`);
    console.log(`\u{1F50E}\u{1F50E}  Presigned URLs: ${JSON.stringify(paymentImageReferences)}`);
    const now = Date.now();
    const newConfirmationEvent = {
      totalCostInCents,
      // lastUpdateTimestamp: now,
      onPaidTimeStamp: now,
      paymentImageUrl: paymentImageReferences.publicUrl,
      ...body
    };
    await saveConfirmedOrder(newConfirmationEvent);
    console.log(`\u2705  Order confirmed and saved for restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`);
    await transmitConfirmationToRestaurant(newConfirmationEvent);
    console.log(`\u2705  Confirmation transmitted to restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`);
    const paymentConfirmationResponse = {
      message: "Order saved successfully and broadcast state synchronized",
      requestId: body.requestId,
      totalPriceInCents: totalCostInCents,
      paymentImageReferences
      // realtimeNotified: ablyDispatchSuccess
    };
    return c.json(paymentConfirmationResponse, 201);
  } catch (error) {
    console.error(`\u{1F6A8} CREATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
paymentsRouter.get("/:restaurantId", async (c) => {
  try {
    const rid = c.req.param("restaurantId");
    if (!rid) {
      return c.json({ error: "Missing restaurantId parameter" }, 400);
    }
    const mappedPayloads = await obtainAllActiveOrders(rid);
    console.log(`\u{1F50E}\u{1F50E}  Mapped payloads for restaurantId: ${rid}: ${JSON.stringify(mappedPayloads)}`);
    console.log(`\u2705  Fetched active orders for restaurantId: ${rid}`);
    return c.json(mappedPayloads, 200);
  } catch (error) {
    console.error(`\u{1F6A8} FETCH PAYMENT PRESELECTIONS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
paymentsRouter.post("/finalize", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    await finalizeOrder(body.restaurantId, body.orderId);
    console.log(`\u2705  Order finalized for restaurantId: ${body.restaurantId}, orderId: ${body.orderId}`);
    return c.json({ message: "Order finalized successfully" }, 200);
  } catch (e) {
    console.error(`\u{1F6A8} FINALIZE ORDER ERROR: ${e.message}`);
    return c.json({ error: e.message || "Internal Server Error" }, 500);
  }
});

// src/repositories/restaurantRepository.ts
import {
  BatchGetCommand as BatchGetCommand3,
  GetCommand,
  PutCommand as PutCommand3,
  QueryCommand as QueryCommand3,
  TransactWriteCommand,
  UpdateCommand as UpdateCommand3
} from "@aws-sdk/lib-dynamodb";
async function putRestaurantMetadata(restaurantId, data) {
  await docClient.send(
    new PutCommand3({
      TableName: TABLE_NAME,
      Item: {
        PK: `REST#${restaurantId}`,
        SK: "METADATA",
        ...data
        // Unpacks and saves all incoming attributes
      }
    })
  );
}
async function getRestaurantMetadata(restaurantId) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `REST#${restaurantId}`,
      SK: "METADATA"
    },
    // Set to true only if you strictly need the absolute latest write
    ConsistentRead: false
  });
  const response = await docClient.send(command);
  return response.Item;
}
async function updateRestaurantMetadata(restaurantId, dataToUpdate) {
  const updateEntries = Object.entries(dataToUpdate).filter(([, value]) => value !== void 0);
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const updateExpressions = updateEntries.map(([field, value], index) => {
    const nameToken = `#field${index}`;
    const valueToken = `:value${index}`;
    expressionAttributeNames[nameToken] = field;
    expressionAttributeValues[valueToken] = value;
    return `${nameToken} = ${valueToken}`;
  });
  if (updateExpressions.length > 0) {
    await docClient.send(new UpdateCommand3({
      TableName: TABLE_NAME,
      Key: {
        PK: `REST#${restaurantId}`,
        SK: "METADATA"
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    }));
  }
}
async function queryUserFeedLinks(userId) {
  const feedLinksResponse = await docClient.send(new QueryCommand3({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `USER#${userId}`,
      ":skPrefix": "SEC#"
    }
  }));
  return feedLinksResponse.Items || [];
}
async function batchGetRestaurantMetadata(restaurantIds) {
  const restaurantKeys = restaurantIds.map((rid) => ({ PK: `REST#${rid}`, SK: "METADATA" }));
  const batchResponse = await docClient.send(new BatchGetCommand3({
    RequestItems: {
      [TABLE_NAME]: {
        Keys: restaurantKeys
        // ConsistentRead: false, // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB) /// FIXME: Necessary here? // Consistent read is used when the read is just after a writting
      }
    }
  }));
  return batchResponse.Responses?.[TABLE_NAME] || [];
}
async function queryRestaurantMenuResources(restaurantId) {
  const response = await docClient.send(new QueryCommand3({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `REST#${restaurantId}`,
      ":skPrefix": "RESOURCE#"
    }
  }));
  return response.Items || [];
}
async function getRestaurantPaymentMetadata(restaurantId) {
  const response = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `REST#${restaurantId}`,
      SK: "METADATA"
    },
    ConsistentRead: false,
    ProjectionExpression: "phoneNumberToPay, phoneNumberToContact, paymentQrUrl"
  }));
  return response.Item;
}
function buildMenuPageDeleteTransactItem(restaurantId, pageId) {
  const sk = `RESOURCE#MENU#${pageId}`;
  return {
    Delete: {
      TableName: TABLE_NAME,
      Key: { PK: `REST#${restaurantId}`, SK: sk }
    }
  };
}
function buildMenuPagePutTransactItem(restaurantId, pageId, pageNumber, publicUrl) {
  const sk = `RESOURCE#MENU#${pageId}`;
  return {
    Put: {
      TableName: TABLE_NAME,
      Item: {
        PK: `REST#${restaurantId}`,
        SK: sk,
        pageNumber: Number(pageNumber || 0),
        /// Take care with that "0"
        imageUrl: publicUrl
        // 🎯 Overwritten with the final public reading URL string destination
      }
    }
  };
}
function buildMenuPageUpdateTransactItem(restaurantId, pageId, updatedFields, publicUrl) {
  const sk = `RESOURCE#MENU#${pageId}`;
  const fieldMapping = {
    imageUrl: "imageUrl",
    pageNumber: "pageNumber"
  };
  const payloadSource = updatedFields;
  const expressions = [];
  const expressionAttributeValues = {};
  for (const [clientKey, dbField] of Object.entries(fieldMapping)) {
    if (payloadSource[clientKey] !== void 0) {
      expressions.push(`${dbField} = :${clientKey}`);
      if (["pageNumber"].includes(clientKey)) {
        expressionAttributeValues[`:${clientKey}`] = Number(payloadSource[clientKey]);
      } else if (clientKey === "imageUrl") {
        expressionAttributeValues[`:${clientKey}`] = publicUrl;
      } else {
        expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
      }
    }
  }
  if (expressions.length === 0) {
    return null;
  }
  return {
    Update: {
      TableName: TABLE_NAME,
      Key: { PK: `REST#${restaurantId}`, SK: sk },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues
    }
  };
}
function buildDishDeleteTransactItem(restaurantId, dishId) {
  const sk = `RESOURCE#DISH#${dishId}`;
  return {
    Delete: {
      TableName: TABLE_NAME,
      Key: { PK: `REST#${restaurantId}`, SK: sk }
    }
  };
}
function buildDishPutTransactItem(restaurantId, dish) {
  const sk = `RESOURCE#DISH#${dish.id}`;
  return {
    Put: {
      TableName: TABLE_NAME,
      Item: {
        // Shape of what is going to be sent
        PK: `REST#${restaurantId}`,
        SK: sk,
        dishName: dish.name,
        priceCents: Number(dish.priceCents || 0),
        prepTime: Number(dish.prepTime || 0),
        isOutOfStock: dish.isOutOfStock,
        menuPageId: dish.menuPageId,
        coordinateXInMenu: dish.coordinateXInMenu,
        coordinateYInMenu: dish.coordinateYInMenu,
        description: dish.description,
        createdAt: Date.now(),
        /**
        * 💡 HINT FOR SIGNED URL TRANSITION:
        * Strip down full path URLs to save only the relative storage object key identifiers
        * when moving to signed asset validation loops.
        */
        imageUrl: dish.imageUrl
      }
    }
  };
}
function buildDishUpdateTransactItem(restaurantId, dishId, updatedFields) {
  const sk = `RESOURCE#DISH#${dishId}`;
  const fieldMapping = {
    name: "dishName",
    priceCents: "priceCents",
    prepTime: "prepTime",
    menuPageId: "menuPageId",
    coordinateXInMenu: "coordinateXInMenu",
    coordinateYInMenu: "coordinateYInMenu",
    description: "description",
    isOutOfStock: "isOutOfStock",
    imageUrl: "imageUrl",
    createdAt: "createdAt"
    /// Maybe it shouldn't be here because it'e never updated
  };
  const payloadSource = updatedFields;
  const expressions = [];
  const expressionAttributeValues = {};
  for (const [clientKey, dbField] of Object.entries(fieldMapping)) {
    if (payloadSource[clientKey] !== void 0) {
      expressions.push(`${dbField} = :${clientKey}`);
      if (["priceCents", "prepTime", "coordinateXInMenu", "coordinateYInMenu", "createdAt"].includes(clientKey)) {
        expressionAttributeValues[`:${clientKey}`] = Number(payloadSource[clientKey]);
      } else if (clientKey === "isOutOfStock") {
        expressionAttributeValues[`:${clientKey}`] = Boolean(payloadSource[clientKey]);
      } else {
        expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
      }
    }
  }
  if (expressions.length === 0) {
    return null;
  }
  return {
    Update: {
      TableName: TABLE_NAME,
      Key: { PK: `REST#${restaurantId}`, SK: sk },
      UpdateExpression: `SET ${expressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues
    }
  };
}
async function executeMenuTransaction(transactionItems) {
  await docClient.send(new TransactWriteCommand({
    TransactItems: transactionItems
  }));
}

// src/services/restaurantService.ts
async function initializeRestaurantInfo(restaurantId, payload) {
  console.log(`\u{1F50E}\u{1F3EA}  Initialize restaurant info whose ID is ${restaurantId}
`, JSON.stringify(payload, null, 2));
  const logoS3Key = `logo/${restaurantId}.webp`;
  const logoPresigned = await generateS3PresignedUrl(logoS3Key);
  console.log("\u{1F50E}\u{1F5BC}\uFE0F  Logo public Url", logoPresigned.publicUrl);
  console.log("\u2705\u{1F5BC}\uFE0F  Logo Url generated");
  const dishImagePublicUrls = [];
  const dishesToUploadShowUrls = [];
  for (let i = 0; i < 3; i++) {
    if (payload.dishesToShowUrlsRequired[i]) {
      const s3Key = `front/${i}/${restaurantId}.webp`;
      const dishPresigned = await generateS3PresignedUrl(s3Key);
      console.log(`\u{1F50E}\u{1F5BC}\uFE0F  dish ${i} to show image public Url`, dishPresigned.publicUrl);
      dishImagePublicUrls.push(dishPresigned.publicUrl);
      dishesToUploadShowUrls[i] = dishPresigned.uploadUrl;
      console.log("\u2705\u{1F5BC}\uFE0F  Dish image upload Url");
    } else {
      dishImagePublicUrls.push("");
      dishesToUploadShowUrls.push("");
    }
  }
  const qrS3Key = `qr/${restaurantId}.webp`;
  const qrPresigned = await generateS3PresignedUrl(qrS3Key);
  console.log("\u{1F50E}\u{1F5BC}\uFE0F  QR public Url", qrPresigned.publicUrl);
  console.log("\u2705\u{1F5BC}\uFE0F  QR Url generated");
  const dataToUpload = {
    name: payload.restaurantName,
    logoUrl: logoPresigned.publicUrl,
    latitude: payload.latitude,
    longitude: payload.longitude,
    dishesToShowUrl1: dishImagePublicUrls[0],
    dishesToShowUrl2: dishImagePublicUrls[1],
    dishesToShowUrl3: dishImagePublicUrls[2],
    phoneNumberToPay: payload.phoneNumberToPay,
    phoneNumberToContact: payload.phoneNumberToContact,
    paymentQrUrl: qrPresigned.publicUrl,
    isOpen: true,
    //true
    isInitialized: true
  };
  console.log(`\u{1F50E}\u{1F3EA}  Initialize restaurant info whose ID is ${restaurantId}
`, JSON.stringify(dataToUpload, null, 2));
  await putRestaurantMetadata(restaurantId, dataToUpload);
  console.log(`\u2705\u2934\uFE0F  restaurant info initialized: ${restaurantId}`);
  return {
    logoPresignedUrl: logoPresigned.uploadUrl,
    dishesToShowPresignedUrls: dishesToUploadShowUrls,
    paymentQrPresignedUrl: qrPresigned.uploadUrl
  };
}
async function obtainRestaurantInfo(restaurantId) {
  const restaurantItem = await getRestaurantMetadata(restaurantId);
  if (!restaurantItem) {
    console.log(`\u26A0\uFE0F\u{1F3EA}  Restaurant (${restaurantId}) wasn't found. Returning an empty restaurant 
`);
    return {
      // Temporal shape for a restaurant that wasn't initialized in the table yet 
      restaurantId: "",
      restaurantName: "",
      logoUrl: "",
      latitude: 0,
      longitude: 0,
      // openTime: '',
      // closeTime: '',
      dishesToShowUrls: ["", "", ""],
      phoneNumberToPay: "",
      phoneNumberToContact: "",
      paymentQrUrl: "",
      // isOpen: true, // TODO
      isInitialized: false
    };
  }
  console.log(`\u{1F50E}\u{1F3EA}  Restaurant info fetched for ID: ${restaurantId}
`, restaurantItem);
  return {
    restaurantId: restaurantItem.PK.replace("REST#", ""),
    restaurantName: restaurantItem.name,
    logoUrl: restaurantItem.logoUrl,
    latitude: restaurantItem.latitude,
    longitude: restaurantItem.longitude,
    // openTime: restaurantItem.openTime,
    // closeTime: restaurantItem.closeTime,
    closeTime: restaurantItem.closeTime,
    dishesToShowUrls: [restaurantItem.dishesToShowUrl1, restaurantItem.dishesToShowUrl2, restaurantItem.dishesToShowUrl3],
    phoneNumberToPay: restaurantItem.phoneNumberToPay,
    phoneNumberToContact: restaurantItem.phoneNumberToContact,
    paymentQrUrl: restaurantItem.paymentQrUrl,
    // isOpen: true, // TODO
    isInitialized: restaurantItem.isInitialized
  };
}
async function updateRestaurantInfo(restaurantId, payload) {
  console.log(`\u{1F50E}\u{1F3EA}  Restaurant info received for ID: ${restaurantId}
`, JSON.stringify(payload, null, 2));
  const dataToUpdate = {
    name: payload.restaurantName,
    latitude: payload.latitude,
    longitude: payload.longitude,
    // openTime: openTime,
    // closeTime: closeTime,
    phoneNumberToPay: payload.phoneNumberToPay,
    phoneNumberToContact: payload.phoneNumberToContact
  };
  let logoUploadUrl;
  if (payload.logoUrlRequired) {
    const logoS3Key = `logo/${restaurantId}.webp`;
    const logoPresigned = await generateS3PresignedUrl(logoS3Key);
    console.log("\u{1F50E}\u{1F5BC}\uFE0F  Logo public Url", logoPresigned.publicUrl);
    logoUploadUrl = logoPresigned.uploadUrl;
    dataToUpdate.logoUrl = logoPresigned.publicUrl;
    console.log("\u2705\u{1F5BC}\uFE0F  Logo upload Url");
  } else {
    logoUploadUrl = "";
  }
  const dishImageSelection = [
    (dishImageUrl) => {
      dataToUpdate.dishesToShowUrl1 = dishImageUrl;
    },
    (dishImageUrl) => {
      dataToUpdate.dishesToShowUrl2 = dishImageUrl;
    },
    (dishImageUrl) => {
      dataToUpdate.dishesToShowUrl3 = dishImageUrl;
    }
  ];
  const dishesToUploadShowUrls = new Array(3);
  for (let i = 0; i < 3; i++) {
    if (payload.dishesToShowUrlsRequired[i] === true) {
      const s3Key = `front/${i}/${restaurantId}.webp`;
      const dishPresigned = await generateS3PresignedUrl(s3Key);
      console.log(`\u{1F50E}\u{1F5BC}\uFE0F  dish ${i} to show image public Url`, dishPresigned.publicUrl);
      dishImageSelection[i](dishPresigned.publicUrl);
      dishesToUploadShowUrls[i] = dishPresigned.uploadUrl;
      console.log("\u2705\u{1F5BC}\uFE0F  Dish image upload Url");
    } else {
      dishesToUploadShowUrls[i] = "";
    }
  }
  let qrUploadUrl;
  if (payload.paymentQrUrlsRequired) {
    const qrS3Key = `qr/${restaurantId}.webp`;
    const qrPresigned = await generateS3PresignedUrl(qrS3Key);
    console.log("\u{1F50E}\u{1F5BC}\uFE0F  QR public Url", qrPresigned.publicUrl);
    dataToUpdate.paymentQrUrl = qrPresigned.publicUrl;
    qrUploadUrl = qrPresigned.uploadUrl;
    console.log("\u2705\u{1F5BC}\uFE0F  QR upload Url");
  } else {
    qrUploadUrl = "";
  }
  await updateRestaurantMetadata(restaurantId, dataToUpdate);
  console.log(`\u2705\u2934\uFE0F Updating restaurant info: ${restaurantId}`);
  return {
    logoPresignedUrl: logoUploadUrl,
    dishesToShowPresignedUrls: dishesToUploadShowUrls,
    paymentQrPresignedUrl: qrUploadUrl
  };
}
async function obtainPersonalizedFeed(userId) {
  console.log(`\u{1F50E}\u{1F60C}  Fetching personalized feed for User: ${userId}`);
  console.log(`\u{1F50E}\u{1F60C} User ID was fown: ${userId}`);
  const feedLinks = await queryUserFeedLinks(userId);
  const MOCK_USER_ID = "00000000-0000-4000-a000-000000000000";
  const MOCK_RESTAURANT_ID = "4258e0fa-6b3c-43bc-a6d8-82c5835d608d";
  const mockFeedLinks = [
    {
      PK: `USER#${MOCK_USER_ID}`,
      SK: `SEC#Popular#${MOCK_RESTAURANT_ID}`,
      addedDate: (/* @__PURE__ */ new Date()).toISOString()
    }
  ];
  console.log("\u{1F50E}\u{1F3EA}  Mock data\n", mockFeedLinks, "\n\u{1F3EA}  seed data\n", feedLinks);
  const sectionMap = {};
  const restaurantIds = [];
  for (const link of mockFeedLinks) {
    const parts = link.SK.split("#");
    const sectionName = parts[1];
    const rid = parts[2];
    restaurantIds.push(rid);
    sectionMap[rid] = sectionName;
  }
  console.log(`\u{1F50E}\u{1F3EA}  restaurantIds: ${JSON.stringify(restaurantIds, null, 2)}`);
  console.log(`\u{1F50E}\u{1F3EA}  sectionMap: ${JSON.stringify(sectionMap, null, 2)}`);
  const rawRestaurants = await batchGetRestaurantMetadata(restaurantIds);
  console.log(`\u{1F50E}\u{1F3EA}  Fetched ${rawRestaurants.length} personalized feed items ${JSON.stringify(rawRestaurants, null, 2)}`);
  const formattedFeed = rawRestaurants.map((res) => {
    const rid = res.PK.replace("REST#", "");
    const originalDishes = [res.dishesToShowUrl1 || "", res.dishesToShowUrl2 || "", res.dishesToShowUrl3 || ""];
    return {
      id: rid,
      name: res.name,
      logoUrl: res.logoUrl || "",
      sectionType: sectionMap[rid] || "General",
      dishesToShowUrls: originalDishes,
      latitude: res.latitude,
      longitude: res.longitude,
      phoneNumberToContact: res.phoneNumberToContact
      //isInitialized // FIXME: Only show restaurants that were initialized
      //isOpen // TODO: When the restaurant is reay to open
    };
  });
  console.log(`\u2705\u{1F3EA} Personalized feed items fetched and formatted for User: ${userId}
`);
  console.log(`A sample of data is
 ${formattedFeed[0]}
`);
  return formattedFeed;
}
async function obtainRestaurantMenu(restaurantId) {
  const items = await queryRestaurantMenuResources(restaurantId);
  const menuPages = [];
  const dishes = [];
  for (const item of items) {
    const sk = item.SK || "";
    if (sk.startsWith("RESOURCE#MENU#")) {
      menuPages.push({
        pageId: sk.replace("RESOURCE#MENU#", ""),
        imageUrl: item.imageUrl || "",
        pageNumber: Number(item.pageNumber || 0)
        /// Check if sending it to page 0 is ok in case of fail
      });
    } else if (sk.startsWith("RESOURCE#DISH#")) {
      if ((item.priceCents ?? null) !== null && (item.prepTime ?? null) !== null) {
        dishes.push({
          id: sk.replace("RESOURCE#DISH#", ""),
          name: item.dishName,
          imageUrl: item.dishImageUrl || "",
          priceCents: Number(item.priceCents),
          /// Does it work without "Number" parser?
          prepTime: Number(item.prepTime),
          isOutOfStock: Boolean(item.isOutOfStock || false),
          menuPageId: item.menuPageId,
          coordinateXInMenu: item.coordinateXInMenu,
          coordinateYInMenu: item.coordinateYInMenu,
          createdAt: item.createdAt,
          description: item.description || ""
        });
      } else {
        console.log(`\u{1F6A8}  There was an issue with the price or preparation time of ${sk.replace("RESOURCE#DISH#", "")} | Fallback: pin is not sent`);
      }
    }
  }
  menuPages.sort((a, b) => a.pageNumber - b.pageNumber);
  console.log(`\u{1F50E}\u{1F4C3}  Menu info attached and mapped for Restaurant ID:
${restaurantId}`);
  console.log("\u{1F50E}  The menu menu pages are:", JSON.stringify(menuPages, null, 2));
  console.log("\u{1F50E}  The menu dishes are:", JSON.stringify(dishes, null, 2));
  return {
    menuPages,
    dishes
  };
}
async function synchronizeRestaurantMenu(restaurantId, payload) {
  const menuPages = payload.menuPages || [];
  const dishes = payload.dishes || [];
  console.log("\u{1F37D}\uFE0F  dishes to update\n", dishes);
  const transactionItems = [];
  const presignedUrls = [];
  console.log(`\u{1F50E}\u{1F4C3}  Pages received:
${JSON.stringify(menuPages, null, 2)}`);
  for (const page of menuPages) {
    const pageId = page.pageId;
    const action = page.action;
    if (action === "delete") {
      transactionItems.push(buildMenuPageDeleteTransactItem(restaurantId, pageId));
    } else if (action === "save" || action === "update") {
      const s3Key = `menus/${pageId}.webp`;
      const pagePresigned = await generateS3PresignedUrl(s3Key);
      console.log("\u{1F50E}  publicUrl", pagePresigned.publicUrl);
      console.log("\u{1F50E}  uploadUrl", pagePresigned.uploadUrl);
      presignedUrls.push({
        pageId,
        uploadUrl: pagePresigned.uploadUrl,
        publicUrl: pagePresigned.publicUrl
      });
      if (action === "save") {
        transactionItems.push(
          buildMenuPagePutTransactItem(restaurantId, pageId, Number(page.pageNumber || 0), pagePresigned.publicUrl)
        );
      } else if (action === "update") {
        const updateItem = buildMenuPageUpdateTransactItem(
          restaurantId,
          pageId,
          page.updatedFields || {},
          pagePresigned.publicUrl
        );
        if (updateItem) {
          transactionItems.push(updateItem);
        }
      }
    }
  }
  for (const dish of dishes) {
    const dishId = dish.id;
    const action = dish.action;
    if (action === "delete") {
      transactionItems.push(buildDishDeleteTransactItem(restaurantId, dishId));
    } else if (action === "save") {
      transactionItems.push(buildDishPutTransactItem(restaurantId, dish));
    } else if (action === "update") {
      const updateItem = buildDishUpdateTransactItem(restaurantId, dishId, dish.updatedFields || {});
      if (updateItem) {
        transactionItems.push(updateItem);
      }
    }
  }
  console.log(`\u{1F50E}\u{1F4C3}  Data to be transacted:
${JSON.stringify(transactionItems, null, 2)}`);
  if (transactionItems.length === 0) {
    return { message: "No menu or dish mutations provided." };
  }
  if (transactionItems.length > 100) {
    throw new Error("Transaction block exceeds AWS limit of 100 items.");
  }
  await executeMenuTransaction(transactionItems);
  const responsePayload = {
    message: "Menu state successfully synchronized atomically",
    presignedUrls
  };
  console.log(`\u2705\u2934\uFE0F TransactWrite completed: Synchronized menu states for Restaurant: ${restaurantId}`);
  return responsePayload;
}
async function obtainRestaurantPaymentInfo(restaurantId) {
  const metadata = await getRestaurantPaymentMetadata(restaurantId);
  if (!metadata) {
    throw new Error("\u{1F6A9} Restaurant payment metadata not found");
  }
  const phoneNumberToPay = metadata.phoneNumberToPay;
  const phoneNumberToContact = metadata.phoneNumberToContact;
  const paymentQrUrl = typeof metadata.paymentQrUrl === "string" ? metadata.paymentQrUrl : "";
  return {
    phoneNumberToPay,
    phoneNumberToContact,
    paymentQrUrl
  };
}

// src/routes/restaurants.ts
var restaurantsRouter = new Hono2();
restaurantsRouter.post("/:restaurantId/info/initialize", async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId) {
      return c.json({ error: "restaurantId is required" }, 400);
    }
    const body = await c.req.json().catch(() => ({}));
    const initializeResponse = await initializeRestaurantInfo(restaurantId, body);
    return c.json(initializeResponse, 200);
  } catch (error) {
    console.error(`\u{1F6A8} RESTAURANT RESTAURANT INFO ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
restaurantsRouter.get("/:restaurantId/info", async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId) {
      return c.json({ error: `Missing restaurantId ${restaurantId}` }, 400);
    }
    const restaurantInfo = await obtainRestaurantInfo(restaurantId);
    return c.json(restaurantInfo);
  } catch (error) {
    return c.json({ error: "Internal Server Error", details: error.message }, 500);
  }
});
restaurantsRouter.post("/:restaurantId/info/update", async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId) {
      return c.json({ error: "restaurantId is required" }, 400);
    }
    const body = await c.req.json().catch(() => ({}));
    const updateResponse = await updateRestaurantInfo(restaurantId, body);
    return c.json(updateResponse, 200);
  } catch (error) {
    console.error(`\u{1F6A8} UPDATE RESTAURANT INFO ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
restaurantsRouter.get("/feed", async (c) => {
  try {
    const userId = c.req.query("userId");
    if (!userId) {
      console.log(`\u{1F534}\u{1F50E}\u{1F60C} User ID was not fown: ${userId}`);
      return c.json({ error: "Missing userId" }, 400);
    }
    const formattedFeed = await obtainPersonalizedFeed(userId);
    return c.json(formattedFeed, 200);
  } catch (error) {
    console.error(`\u{1F6A8} FEED ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
restaurantsRouter.get("/:restaurantId/menu", async (c) => {
  try {
    const rid = c.req.param("restaurantId");
    if (!rid) {
      return c.json({ error: "restaurantId is required" }, 400);
    }
    const menuResponse = await obtainRestaurantMenu(rid);
    return c.json(menuResponse, 200);
  } catch (error) {
    console.error(`\u{1F6A8} MENU ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
restaurantsRouter.post("/:restaurantId/menu", async (c) => {
  try {
    const rid = c.req.param("restaurantId");
    if (!rid) {
      return c.json({ error: "restaurantId is required" }, 400);
    }
    const body = await c.req.json().catch(() => ({}));
    const syncResult = await synchronizeRestaurantMenu(rid, body);
    if ("presignedUrls" in syncResult) {
      return c.json(syncResult, 200);
    }
    return c.json(syncResult, 200);
  } catch (error) {
    if (error.message === "Transaction block exceeds AWS limit of 100 items.") {
      return c.json({ error: error.message }, 400);
    }
    console.error(`\u{1F6A8} SYNC MENU ROUTE ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
restaurantsRouter.get("/:restaurantId/payment", async (c) => {
  try {
    const rid = c.req.param("restaurantId");
    if (!rid) {
      return c.json({ error: "restaurantId is required" }, 400);
    }
    const paymentInfo = await obtainRestaurantPaymentInfo(rid);
    return c.json(paymentInfo, 200);
  } catch (error) {
    if (error.message === "\u{1F6A9} Restaurant payment metadata not found") {
      return c.json({ error: error.message }, 404);
    }
    console.error(`\u{1F6A8} RESTAURANT PAYMENT ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// src/repositories/userRepository.ts
import { PutCommand as PutCommand4, DeleteCommand as DeleteCommand2 } from "@aws-sdk/lib-dynamodb";
async function putPreference(userId, prefId, body) {
  const pk = `USER#${userId}`;
  const sk = `PREF#${prefId}`;
  const preferenceItem = {
    PK: pk,
    SK: sk,
    userId,
    // Redundant but useful for GSIs later
    prefId,
    title: body.title,
    description: body.description,
    color: body.color,
    createdAt: body.createdAt ? Number(body.createdAt) : void 0
    // Maps Kotlin Long timestamp cleanly
  };
  await docClient.send(new PutCommand4({
    TableName: TABLE_NAME,
    Item: preferenceItem
  }));
}
async function deletePreference(userId, prefId) {
  const pk = `USER#${userId}`;
  const sk = `PREF#${prefId}`;
  await docClient.send(new DeleteCommand2({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk }
  }));
}

// src/services/userService.ts
async function saveUserPreference(userId, prefId, body) {
  await putPreference(userId, prefId, body);
}
async function deleteUserPreference(userId, prefId) {
  await deletePreference(userId, prefId);
}

// src/routes/users.ts
var usersRouter = new Hono2();
usersRouter.put("/:userId/preferences/:prefId", async (c) => {
  try {
    const user_id = c.req.param("userId");
    const pref_id = c.req.param("prefId");
    if (!user_id || !pref_id) {
      return c.json({ error: "Missing userId or prefId in path" }, 400);
    }
    const body = await c.req.json().catch(() => ({}));
    await saveUserPreference(user_id, pref_id, body);
    console.log(`\u2705\u{1F64B} The preference ${pref_id} for user ${user_id} was successfully added`);
    return c.json({ message: "Preference saved successfully" }, 200);
  } catch (error) {
    console.error(`\u{1F6A9} USER PREF PUT ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
usersRouter.delete("/:userId/preferences/:prefId", async (c) => {
  try {
    const user_id = c.req.param("userId");
    const pref_id = c.req.param("prefId");
    if (!user_id || !pref_id) {
      return c.json({ error: "Missing userId or prefId in path" }, 400);
    }
    await deleteUserPreference(user_id, pref_id);
    console.log(`\u2705\u{1F5D1}\uFE0F The preference ${pref_id} of user ${user_id} was successfully deleted`);
    return c.body(null, 204);
  } catch (error) {
    console.error(`\u{1F6A9} USER PREF DELETE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// src/repositories/contactRepository.ts
import { PutCommand as PutCommand5 } from "@aws-sdk/lib-dynamodb";
async function putFeedback(FeedbackPayload) {
  const newFeedbackItem = {
    PK: `USER#${FeedbackPayload.userId}`,
    // FIXME: I think is better to put the Feedback as partition key, because we look for set of feedbacks, not for specific user's feedback
    SK: `FEEDBACK#${crypto.randomUUID()}`,
    // TODO: Try with timestamp instead of UUID
    requestId: FeedbackPayload.requestId,
    conformDegree: FeedbackPayload.conformDegree,
    description: FeedbackPayload.description
  };
  await docClient.send(new PutCommand5({
    TableName: TABLE_NAME,
    Item: newFeedbackItem
  }));
}
async function putRestaurantContact(restaurantContactPayload) {
  const newFinalContactItem = {
    PK: `USER#${restaurantContactPayload.userId}`,
    SK: `RCONTACT#${crypto.randomUUID()}`,
    restaurantName: restaurantContactPayload.restaurantName,
    restaurantContact: restaurantContactPayload.restaurantContact,
    restaurantComment: restaurantContactPayload.restaurantComment
  };
  console.log("\u{1F4BD} Contact Item to save in DynamoDB", JSON.stringify(newFinalContactItem, null, 2));
  await docClient.send(new PutCommand5({
    TableName: TABLE_NAME,
    Item: newFinalContactItem
  }));
}

// src/services/contactService.ts
async function saveFeedback(body) {
  if (!body.userId) {
    throw new Error("Missing userId");
  }
  await putFeedback(body);
}
async function saveRestaurantContact(body) {
  await putRestaurantContact(body);
}

// src/routes/contacts.ts
var contactsRouter = new Hono2();
contactsRouter.post("/feedback", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    await saveFeedback(body);
    console.log("\u2705\u{1F4BD} Feedback Item saved in DynamoDB successfully");
    return c.json({
      message: "Feedback saved successfully"
      /// Put in an interface
    }, 201);
  } catch (error) {
    console.error(`\u{1F6A8} SAVE FEEDBACK ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
contactsRouter.post("/restaurant", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    await saveRestaurantContact(body);
    console.log("\u2705\u{1F4BD} Feedback Item saved in DynamoDB successfully");
    return c.json({
      message: "Contact saved successfully"
    }, 201);
  } catch (error) {
    console.error(`\u{1F6A8} SAVE CONTACT ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// src/index.ts
var app = new Hono2();
app.use(
  "/*",
  cors({
    origin: (origin) => origin.includes("localhost") ? origin : null,
    // Dynamically allows any local port (3000, 5173, etc.)
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // TODO: Should I include "PATCH"?
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true
  })
);
app.route("/payments", paymentsRouter);
app.route("/requests", requestsRouter);
app.route("/restaurants", restaurantsRouter);
app.route("/users", usersRouter);
app.route("/contacts", contactsRouter);
app.get("/", (c) => {
  return c.json({
    status: "healthy",
    service: "Yummizi Engine",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var handler = handle(app);
if (process.env.NODE_ENV === "development" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  import("@hono/node-server").then(({ serve }) => {
    const port = 3e3;
    console.log(`
=================================================`);
    console.log(`\u{1F3C3}\u200D\u2642\uFE0F Yummizi Engine listening on http://localhost:${port}`);
    console.log(`\u{1F4A1} Standalone mode active: testing routes is super fast!`);
    console.log(`=================================================
`);
    serve({
      fetch: app.fetch,
      port
    });
  });
}
var index_default = app;
export {
  index_default as default,
  handler
};
