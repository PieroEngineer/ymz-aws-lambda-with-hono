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

// src/routes/requests.ts
import { QueryCommand, PutCommand, UpdateCommand, DynamoDBDocumentClient, DeleteCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

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

// src/k.ts
var ablyKeyWS = "4w64MA.R_FXWQ:2BlLaKwCQu5o2R6EoCt9RwNcoGNHIxOWs9pPFodpMhQ";

// src/routes/requests.ts
var docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true }
});
var TABLE_NAME = "YummiziTable";
var requestsRouter = new Hono2();
requestsRouter.post("/create", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const restaurantId = body.restaurantId;
    const userId = body.userId;
    const requestId = body.requestId;
    const groupSize = body.groupSize;
    const userName = body.userName;
    const arrivalTime = body.arrivalTime;
    if (!restaurantId || !userId || !requestId) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }
    const requestTime = Date.now();
    const mockUserSpecifics = ["special day", "with vehicule"];
    const baseRequestInfo = {
      userId,
      userName,
      groupSize,
      onQueuedTimestamp: requestTime,
      state: "QUEUED",
      specifics: mockUserSpecifics,
      arrivlaTime: arrivalTime
    };
    const newRequestItem = {
      PK: `REST#${restaurantId}`,
      SK: `REQ#${requestId}`,
      ...baseRequestInfo
    };
    console.log("\u{1F4BD}  Request Item to save in DynamoDB", JSON.stringify(newRequestItem, null, 2), "\nfor restaurant ", restaurantId);
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newRequestItem
    }));
    const clientPayload = {
      requestId,
      ...baseRequestInfo
    };
    const apiKey = ablyKeyWS;
    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not defined");
    }
    const [username, password] = apiKey.split(":");
    const credentials = btoa(`${username}:${password}`);
    const channelName = `restaurant:${restaurantId}:ops`;
    const requestName = "table-requested";
    const ablyEndpoint = `https://rest.ably.io/channels/${channelName}/messages`;
    let ablyDispatchSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;
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
            name: requestName,
            // The targeted subscriber frequency path matching mock constraints
            data: clientPayload
            // The exact TableRequestPayload DTO shape your staff app consumes
          })
        });
        if (ablyResponse.ok) {
          ablyDispatchSuccess = true;
          console.log(`\u{1F4E1} [Attempt ${attempts}] Successfully broadcast table request event to Ably channel: ${channelName}`);
          console.log(`\u{1F4E6}  Data to send: ${JSON.stringify({ name: requestName, data: clientPayload }, null, 2)}`);
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
    return c.json({
      message: "Request created successfully and broadcast state synchronized",
      requestId,
      realtimeNotified: ablyDispatchSuccess
    }, 201);
  } catch (error) {
    console.error(`\u{1F6A8} CREATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
requestsRouter.post("/:requestId/cancel", async (c) => {
  try {
    const requestId = c.req.param("requestId");
    const body = await c.req.json().catch(() => ({}));
    const restaurantId = body.restaurantId;
    if (!requestId || !restaurantId) {
      return c.json({ error: "Missing requestId or restaurantId" }, 400);
    }
    const pk = `REST#${restaurantId}`;
    const sk = `REQ#${requestId}`;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    await docClient.send(new DeleteCommand({
      // TODO: This is temporal  code and should be alternated with the commented code that is just above
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk }
    }));
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
    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${rid}`,
        ":skPrefix": "REQ#"
      }
    };
    const dbResult = await docClient.send(new QueryCommand(queryParams));
    const rawItems = dbResult.Items || [];
    console.log(`\u{1F50D} Raw data to respond the GET request 
${JSON.stringify(rawItems)} 
For Restaurant: ${rid}`);
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
For Restaurant: ${rid}`);
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
    const requestId = body.requestId;
    const newState = body.newState;
    const userId = body.userId;
    console.log(`1\uFE0F\u20E3\u{1F4E6}  Data arrived from restaurant ${restaurantId} 
${JSON.stringify(body)}`);
    if (!restaurantId || !requestId || !newState) {
      return c.json({ error: "Missing restaurantId, requestId, or newState" }, 400);
    }
    const pk = `REST#${restaurantId}`;
    const sk = `REQ#${requestId}`;
    const normalizedState = String(newState);
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
    const channelName = {
      ACCEPTED: `request:${userId}`,
      READY: `restaurant:${restaurantId}:ops`,
      PAY_TRIED: `restaurant:${restaurantId}:ops`
    };
    const apiKey = ablyKeyWS;
    let realtimeNotified = false;
    if (apiKey) {
      const [username, password] = apiKey.split(":");
      const credentials = btoa(`${username}:${password}`);
      console.log(`1\uFE0F\u20E3\u{1F4FA}  Channel to subscrive ${channelName[normalizedState]}`);
      const ablyEndpoint = `https://rest.ably.io/channels/${channelName[normalizedState]}/messages`;
      try {
        const ablyResponse = await fetch(ablyEndpoint, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: "request-status-updated",
            /// Consider change Message's name by a code for security 
            data: {
              // TODO: Move this to an object like above
              //X restaurantId,
              requestId,
              newStatus: normalizedState
            }
          })
        });
        realtimeNotified = ablyResponse.ok;
        if (!ablyResponse.ok) {
          console.warn(`\u26A0\uFE0F Failed to broadcast request status update to Ably, status=${ablyResponse.status}`);
        }
      } catch (error) {
        console.warn(`\u26A0\uFE0F Failed to broadcast request status update to Ably: ${error.message}`);
      }
    } else {
      console.warn("\u26A0\uFE0F ABLY_API_KEY is not defined; skipping realtime broadcast.");
    }
    console.log(`\u{1F50E}  The post of the request update finished`);
    return c.json({
      message: "Request state updated successfully",
      restaurantId,
      requestId,
      newState: normalizedState,
      realtimeNotified
    }, 200);
  } catch (error) {
    console.error(`\u{1F6A8} UPDATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
requestsRouter.post("/active", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const requestsToUpdate = body.requestsToUpdate;
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
    const requestItems = batchResponse.Responses?.[TABLE_NAME] || [];
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
    return c.json({
      statuses: mappedPayloads
    }, 200);
  } catch (error) {
    console.error(`\u{1F6A8} FETCH ACTIVE REQS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// src/routes/payments.ts
import { QueryCommand as QueryCommand2, PutCommand as PutCommand2, DynamoDBDocumentClient as DynamoDBDocumentClient2, BatchGetCommand as BatchGetCommand2 } from "@aws-sdk/lib-dynamodb";

// src/services/paymentService.ts
function calculateTotalCost(selectedDishes, dynamoDbResponsesWithPrices) {
  const numDbItems = dynamoDbResponsesWithPrices.length;
  const numInputItems = selectedDishes.length;
  const priceMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < numDbItems; i++) {
    const item = dynamoDbResponsesWithPrices[i];
    const dishId = item.SK.replace("RESOURCE#DISH#", "");
    if (item && dishId !== void 0 && item.priceCents !== void 0) {
      priceMap.set(dishId, item.priceCents);
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
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var paymentsRouter = new Hono2();
var s3Client = getS3Client();
var docClient2 = DynamoDBDocumentClient2.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true }
});
var TABLE_NAME2 = "YummiziTable";
var BUCKET_NAME = "restaurant-assets";
paymentsRouter.post("/confirm", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const restaurantId = body.restaurantId;
  const userId = body.userId;
  const requestId = body.requestId;
  const userName = body.userName;
  const arrivalTimeInMinutes = body.arrivalTimeInMinutes;
  const groupSize = body.groupSize;
  const orderSelections = body.orderSelections;
  if (!restaurantId || !userId || !requestId) {
    return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
  }
  const keys = orderSelections.map((selection) => ({
    PK: `REST#${restaurantId}`,
    SK: `RESOURCE#DISH#${selection.dishId}`
  }));
  const command = new BatchGetCommand2({
    /// Analyze if a transaction is more proper for this situation
    RequestItems: {
      [TABLE_NAME2]: {
        Keys: keys,
        ConsistentRead: false,
        // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB)
        ProjectionExpression: "priceCents, SK"
        // Optional: Save bandwidth
      }
    }
  });
  const response = await docClient2.send(command);
  const dishItems = response.Responses?.[TABLE_NAME2] || [];
  const totalCostInCents = calculateTotalCost(orderSelections, dishItems);
  const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`;
  const s3Key = `menus/${restaurantId}/${requestId}.webp`;
  const unixEpoch = Math.floor(Date.now() / 1e3);
  const publicUrl = `${s3BaseUrl}/${s3Key}?v=${unixEpoch}`;
  console.log("\u{1F50E}  publicUrl", publicUrl);
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
  const paymentImageReferences = {
    uploadUrl,
    publicUrl
  };
  const basePaymentPreselection = {
    lastUpdateTimestamp: Date.now(),
    userName,
    userId,
    orderSelections,
    arrivalTimeInMinutes,
    groupSize,
    totalCostInCents,
    onPaidTimeStamp: Date.now()
    //paymentMethod,
  };
  const paymentPreselectionItem = {
    PK: `REST#${restaurantId}`,
    SK: `ORDER#${requestId}`,
    /// Perphaps it should be a new ID, not the request ID
    ...basePaymentPreselection
  };
  console.log("\u{1F4BD}  Order to save in DynamoDB", JSON.stringify(paymentPreselectionItem, null, 2), "\nfor restaurant ", restaurantId);
  try {
    await docClient2.send(new PutCommand2({
      TableName: TABLE_NAME2,
      Item: paymentPreselectionItem
    }));
    const clientPayload = {
      requestId,
      ...basePaymentPreselection
    };
    const apiKey = ablyKeyWS;
    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not defined");
    }
    const [username, password] = apiKey.split(":");
    const credentials = btoa(`${username}:${password}`);
    const channelName = `restaurant:${restaurantId}:ops`;
    const requestName = "new-order-preselected";
    const ablyEndpoint = `https://rest.ably.io/channels/${channelName}/messages`;
    let ablyDispatchSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;
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
            name: requestName,
            // The targeted subscriber frequency path matching mock constraints
            data: clientPayload
            // The exact TableRequestPayload DTO shape your staff app consumes
          })
        });
        if (ablyResponse.ok) {
          ablyDispatchSuccess = true;
          console.log(`\u{1F4E1} [Attempt ${attempts}] Successfully order preselection event to Ably channel: ${channelName}`);
          console.log(`\u{1F4E6}  Order to send: ${JSON.stringify({ name: requestName, data: clientPayload }, null, 2)}`);
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
    return c.json({
      message: "Order saved successfully and broadcast state synchronized",
      requestId,
      totalPriceInCents: totalCostInCents,
      paymentImageReferences
      // realtimeNotified: ablyDispatchSuccess
    }, 201);
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
    const queryParams = {
      TableName: TABLE_NAME2,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${rid}`,
        ":skPrefix": "ORDER#"
      }
    };
    const dbResult = await docClient2.send(new QueryCommand2(queryParams));
    const rawItems = dbResult.Items || [];
    const mappedPayloads = rawItems.map((item) => {
      const requestId = item.SK.replace("ORDER#", "");
      return {
        requestId,
        userName: item.userName,
        lastUpdateTimestamp: item.lastUpdateTimestamp,
        userId: item.userId,
        orderSelections: item.orderSelections,
        arrivalTimeInMinutes: item.arrivalTimeInMinutes,
        groupSize: item.groupSize,
        totalCostInCents: item.totalCostInCents,
        onPaidTimeStamp: item.onPaidTimeStamp
      };
    });
    return c.json(mappedPayloads, 200);
  } catch (error) {
    console.error(`\u{1F6A8} FETCH PAYMENT PRESELECTIONS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// src/routes/restaurants.ts
import { QueryCommand as QueryCommand3, BatchGetCommand as BatchGetCommand3, GetCommand, DynamoDBDocumentClient as DynamoDBDocumentClient3 } from "@aws-sdk/lib-dynamodb";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand as PutObjectCommand2 } from "@aws-sdk/client-s3";
import { getSignedUrl as getSignedUrl2 } from "@aws-sdk/s3-request-presigner";
var s3Client2 = getS3Client();
var docClient3 = DynamoDBDocumentClient3.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true }
});
var TABLE_NAME3 = "YummiziTable";
var BUCKET_NAME2 = "restaurant-assets";
var restaurantsRouter = new Hono2();
restaurantsRouter.get("/feed", async (c) => {
  try {
    const userId = c.req.query("userId");
    if (!userId) {
      return c.json({ error: "Missing userId" }, 400);
    }
    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME2}`;
    const feedLinksResponse = await docClient3.send(new QueryCommand3({
      TableName: TABLE_NAME3,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":skPrefix": "SEC#"
      }
    }));
    const feedLinks = feedLinksResponse.Items || [];
    if (feedLinks.length === 0) {
      return c.json([], 200);
    }
    const restaurantKeys = [];
    const sectionMap = {};
    for (const link of feedLinks) {
      const parts = link.SK.split("#");
      const sectionName = parts[1];
      const rid = parts[2];
      restaurantKeys.push({ PK: `REST#${rid}`, SK: "METADATA" });
      sectionMap[rid] = sectionName;
    }
    const batchResponse = await docClient3.send(new BatchGetCommand3({
      RequestItems: {
        [TABLE_NAME3]: {
          Keys: restaurantKeys
          // ConsistentRead: false, // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB) /// Necessary here? // Consistent read is used when the read is just after a writting
        }
      }
    }));
    const rawRestaurants = batchResponse.Responses?.[TABLE_NAME3] || [];
    const formattedFeed = rawRestaurants.map((res) => {
      const rid = res.PK.replace("REST#", "");
      const originalDishes = res.dishesToShow || [];
      return {
        id: rid,
        name: res.name,
        logoUrl: res.logoUrl || "",
        sectionType: sectionMap[rid] || "General",
        dishesToShowUrls: originalDishes
      };
    });
    console.log(`\u2705\u{1F3EA} Personalized feed items fetched and formatted for User: ${userId}
`);
    console.log(`A sample of data is
 ${formattedFeed[0]}
`);
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
    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME2}`;
    const response = await docClient3.send(new QueryCommand3({
      TableName: TABLE_NAME3,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${rid}`,
        ":skPrefix": "RESOURCE#"
      }
    }));
    const items = response.Items || [];
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
${rid}`);
    return c.json({
      menuPages,
      dishes
    }, 200);
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
    const menuPages = body.menuPages || [];
    const dishes = body.dishes || [];
    console.log("\u{1F37D}\uFE0F  dishes to update\n", dishes);
    const transactionItems = [];
    const presignedUrls = [];
    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME2}`;
    console.log(`\u{1F50E}\u{1F4C3}  Pages received:
${JSON.stringify(menuPages, null, 2)}`);
    for (const page of menuPages) {
      const pageId = page.pageId;
      const action = page.action;
      const sk = `RESOURCE#MENU#${pageId}`;
      if (action === "delete") {
        transactionItems.push({
          Delete: {
            TableName: TABLE_NAME3,
            Key: { PK: `REST#${rid}`, SK: sk }
          }
        });
      } else if (action === "save" || action === "update") {
        const s3Key = `menus/${pageId}.webp`;
        const unixEpoch = Math.floor(Date.now() / 1e3);
        const publicUrl = `${s3BaseUrl}/${s3Key}?v=${unixEpoch}`;
        console.log("\u{1F50E}  publicUrl", publicUrl);
        const uploadUrl = await getSignedUrl2(
          s3Client2,
          new PutObjectCommand2({
            Bucket: BUCKET_NAME2,
            Key: s3Key,
            ContentType: "image/webp"
            // Enforces binary media type constraints
          }),
          { expiresIn: 900 }
          // URL token token expires safely in 15 minutes
        );
        console.log("\u{1F50E}  uploadUrl", uploadUrl);
        presignedUrls.push({
          pageId,
          uploadUrl,
          publicUrl
        });
        if (action === "save") {
          transactionItems.push({
            Put: {
              TableName: TABLE_NAME3,
              Item: {
                PK: `REST#${rid}`,
                SK: sk,
                pageNumber: Number(page.pageNumber || 0),
                /// Take care with that "0"
                imageUrl: publicUrl
                // 🎯 Overwritten with the final public reading URL string destination
              }
            }
          });
        } else if (action === "update") {
          const fieldMapping = {
            imageUrl: "imageUrl",
            pageNumber: "pageNumber"
          };
          const payloadSource = page.updatedFields;
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
          if (expressions.length > 0) {
            transactionItems.push({
              Update: {
                TableName: TABLE_NAME3,
                Key: { PK: `REST#${rid}`, SK: sk },
                UpdateExpression: `SET ${expressions.join(", ")}`,
                ExpressionAttributeValues: expressionAttributeValues
              }
            });
          }
        }
      }
    }
    for (const dish of dishes) {
      const dishId = dish.id;
      const action = dish.action;
      const sk = `RESOURCE#DISH#${dishId}`;
      if (action === "delete") {
        transactionItems.push({
          Delete: {
            TableName: TABLE_NAME3,
            Key: { PK: `REST#${rid}`, SK: sk }
          }
        });
      } else if (action === "save") {
        transactionItems.push({
          Put: {
            TableName: TABLE_NAME3,
            Item: {
              // Shape of what is going to be sent
              PK: `REST#${rid}`,
              SK: sk,
              dishName: dish.name,
              priceCents: Number(dish.priceCents || 0),
              prepTime: Number(dish.prepTime || 0),
              isOutOfStock: false,
              // Per request constraint: always false for now
              menuPageId: dish.menuPageId,
              coordinateXInMenu: dish.coordinateXInMenu,
              coordinateYInMenu: dish.coordinateYInMenu,
              description: dish.description,
              /**
              * 💡 HINT FOR SIGNED URL TRANSITION:
              * Strip down full path URLs to save only the relative storage object key identifiers
              * when moving to signed asset validation loops.
              */
              imageUrl: dish.imageUrl
            }
          }
        });
      } else if (action === "update") {
        const fieldMapping = {
          name: "dishName",
          priceCents: "priceCents",
          prepTime: "prepTime",
          menuPageId: "menuPageId",
          coordinateXInMenu: "coordinateXInMenu",
          coordinateYInMenu: "coordinateYInMenu",
          description: "description",
          isOutOfStock: "isOutOfStock",
          imageUrl: "imageUrl"
        };
        const payloadSource = dish.updatedFields;
        const expressions = [];
        const expressionAttributeValues = {};
        for (const [clientKey, dbField] of Object.entries(fieldMapping)) {
          if (payloadSource[clientKey] !== void 0) {
            expressions.push(`${dbField} = :${clientKey}`);
            if (["priceCents", "prepTime", "coordinateXInMenu", "coordinateYInMenu"].includes(clientKey)) {
              expressionAttributeValues[`:${clientKey}`] = Number(payloadSource[clientKey]);
            } else if (clientKey === "isOutOfStock") {
              expressionAttributeValues[`:${clientKey}`] = Boolean(payloadSource[clientKey]);
            } else {
              expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
            }
          }
        }
        if (expressions.length > 0) {
          transactionItems.push({
            Update: {
              TableName: TABLE_NAME3,
              Key: { PK: `REST#${rid}`, SK: sk },
              UpdateExpression: `SET ${expressions.join(", ")}`,
              ExpressionAttributeValues: expressionAttributeValues
            }
          });
        }
      }
    }
    console.log(`\u{1F50E}\u{1F4C3}  Data to be transacted:
${JSON.stringify(transactionItems, null, 2)}`);
    if (transactionItems.length === 0) {
      return c.json({ message: "No menu or dish mutations provided." }, 200);
    }
    if (transactionItems.length > 100) {
      return c.json({ error: "Transaction block exceeds AWS limit of 100 items." }, 400);
    }
    await docClient3.send(new TransactWriteCommand({
      TransactItems: transactionItems
    }));
    const responsePayload = {
      message: "Menu state successfully synchronized atomically",
      presignedUrls
    };
    console.log(`\u2705\u2934\uFE0F TransactWrite completed: Synchronized menu states for Restaurant: ${rid}`);
    return c.json(responsePayload, 200);
  } catch (error) {
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
    const response = await docClient3.send(new GetCommand({
      TableName: TABLE_NAME3,
      Key: {
        PK: `REST#${rid}`,
        SK: "METADATA"
      },
      ConsistentRead: false,
      ProjectionExpression: "phoneNumberToPay, phoneNumberToContact, paymentQrUrl"
    }));
    const metadata = response.Item;
    if (!metadata) {
      return c.json({ error: "\u{1F6A9} Restaurant payment metadata not found" }, 404);
    }
    const phoneNumberToPay = Number(metadata.phoneNumberToPay);
    const phoneNumberToContact = Number(metadata.phoneNumberToContact);
    const paymentQrUrl = typeof metadata.paymentQrUrl === "string" ? metadata.paymentQrUrl : "";
    return c.json({
      phoneNumberToPay,
      phoneNumberToContact,
      paymentQrUrl
    }, 200);
  } catch (error) {
    console.error(`\u{1F6A8} RESTAURANT PAYMENT ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// src/routes/users.ts
import { PutCommand as PutCommand3, DeleteCommand as DeleteCommand2, DynamoDBDocumentClient as DynamoDBDocumentClient4 } from "@aws-sdk/lib-dynamodb";
var docClient4 = DynamoDBDocumentClient4.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true }
});
var TABLE_NAME4 = "YummiziTable";
var usersRouter = new Hono2();
usersRouter.put("/:userId/preferences/:prefId", async (c) => {
  try {
    const user_id = c.req.param("userId");
    const pref_id = c.req.param("prefId");
    if (!user_id || !pref_id) {
      return c.json({ error: "Missing userId or prefId in path" }, 400);
    }
    const body = await c.req.json().catch(() => ({}));
    const pk = `USER#${user_id}`;
    const sk = `PREF#${pref_id}`;
    const preferenceItem = {
      PK: pk,
      SK: sk,
      userId: user_id,
      // Redundant but useful for GSIs later
      prefId: pref_id,
      title: body.title,
      description: body.description,
      color: body.color,
      createdAt: body.createdAt ? Number(body.createdAt) : void 0
      // Maps Kotlin Long timestamp cleanly
    };
    await docClient4.send(new PutCommand3({
      TableName: TABLE_NAME4,
      Item: preferenceItem
    }));
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
    const pk = `USER#${user_id}`;
    const sk = `PREF#${pref_id}`;
    await docClient4.send(new DeleteCommand2({
      TableName: TABLE_NAME4,
      Key: { PK: pk, SK: sk }
    }));
    console.log(`\u2705\u{1F5D1}\uFE0F The preference ${pref_id} of user ${user_id} was successfully deleted`);
    return c.body(null, 204);
  } catch (error) {
    console.error(`\u{1F6A9} USER PREF DELETE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// src/routes/contacts.ts
import { PutCommand as PutCommand4, DynamoDBDocumentClient as DynamoDBDocumentClient5 } from "@aws-sdk/lib-dynamodb";
var contactsRouter = new Hono2();
var TABLE_NAME5 = "YummiziTable";
var docClient5 = DynamoDBDocumentClient5.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true }
});
contactsRouter.post("/feedback", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId;
    const requestId = body.requestId;
    const conformDegree = body.conformDegree;
    const description = body.description;
    if (!userId) {
      return c.json({ error: "Missing userId" }, 400);
    }
    const newFinalFeedbackItem = {
      PK: `USER#${userId}`,
      SK: `FEEDBACK#${crypto.randomUUID()}`,
      requestId,
      conformDegree,
      description
    };
    console.log("\u{1F4BD} Feedback Item to save in DynamoDB", JSON.stringify(newFinalFeedbackItem, null, 2), "\nfor request ", requestId);
    await docClient5.send(new PutCommand4({
      TableName: TABLE_NAME5,
      Item: newFinalFeedbackItem
    }));
    return c.json({
      message: "Feedback saved successfully"
      // realtimeNotified: ablyDispatchSuccess
    }, 201);
  } catch (error) {
    console.error(`\u{1F6A8} SAVE FEEDBACK ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});
contactsRouter.post("/restaurant", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const userId = body.userId;
    const restaurantName = body.restaurantName;
    const restaurantContact = body.restaurantContact;
    const restaurantComment = body.restaurantComment;
    const newFinalContactItem = {
      PK: `USER#${userId}`,
      SK: `RCONTACT#${crypto.randomUUID()}`,
      restaurantName,
      restaurantContact,
      restaurantComment
    };
    console.log("\u{1F4BD} Contact Item to save in DynamoDB", JSON.stringify(newFinalContactItem, null, 2));
    await docClient5.send(new PutCommand4({
      TableName: TABLE_NAME5,
      Item: newFinalContactItem
    }));
    return c.json({
      message: "Contact saved successfully"
      // realtimeNotified: ablyDispatchSuccess
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
