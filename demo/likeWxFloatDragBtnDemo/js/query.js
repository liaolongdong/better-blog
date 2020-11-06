/**
 * DOM related Functions
 */

// 判断是否为数组
function isArray(value) {
  return Object.prototype.toString.call(value) == "[object Array]";
}

const $ = {};

if (!Array.from) {
  Array.from = function (collection) {
    const arr = [];

    for (let i = 0; i < collection.length; i++) {
      arr.push(collection[i]);
    }

    return arr;
  };
}

/**
 * get single element
 * @public
 */
$.one = function (selector, contextElement) {
  try {
    return (contextElement || document).querySelector(selector) || undefined;
  } catch (e) {
    return undefined;
  }
};

/**
 * get multiple elements
 * @public
 */
$.all = function (selector, contextElement) {
  try {
    const nodeList = (contextElement || document).querySelectorAll(selector);
    return Array.from(nodeList);
  } catch (e) {
    return [];
  }
};

/**
 * add className(s) to an or multiple element(s)
 * @public
 */
$.addClass = function ($el, className) {
  if (!$el) {
    return;
  }
  if (!isArray($el)) {
    $el = [$el];
  }
  for (let i = 0; i < $el.length; i++) {
    let name = $el[i].className || "",
      arr = name.split(" ");
    if (arr.indexOf(className) > -1) {
      continue;
    }
    arr.push(className);
    $el[i].className = arr.join(" ");
  }
};

/**
 * remove className(s) from an or multiple element(s)
 * @public
 */
$.removeClass = function ($el, className) {
  if (!$el) {
    return;
  }
  if (!isArray($el)) {
    $el = [$el];
  }
  for (let i = 0; i < $el.length; i++) {
    let arr = $el[i].className.split(" ");
    for (let j = 0; j < arr.length; j++) {
      if (arr[j] == className) {
        arr[j] = "";
      }
    }
    $el[i].className = arr.join(" ").trim();
  }
};

/**
 * see whether an element contains a className
 * @public
 */
$.hasClass = function ($el, className) {
  if (!$el || !$el.classList) {
    return false;
  }
  return $el.classList.contains(className);
};

/**
 * bind an event to element(s)
 * @public
 * @param  array    $el      element object or array
 * @param  string    eventType  name of the event
 * @param  function  fn
 * @param  boolean    useCapture
 */
$.bind = function ($el, eventType, fn, useCapture) {
  if (!$el) {
    return;
  }
  if (!isArray($el)) {
    $el = [$el];
  }
  $el.forEach((el) => {
    el.addEventListener(eventType, fn, !!useCapture);
  });
};

/**
 * delegate an event to a parent element
 * @public
 * @param  array     $el        parent element
 * @param  string    eventType  name of the event
 * @param  string    selector   target's selector
 * @param  function  fn
 */
$.delegate = function ($el, eventType, selector, fn) {
  if (!$el) {
    return;
  }
  $el.addEventListener(
    eventType,
    function (e) {
      let targets = $.all(selector, $el);
      if (!targets) {
        return;
      }
      findTarget: for (let i = 0; i < targets.length; i++) {
        let $node = e.target;
        while ($node) {
          if ($node == targets[i]) {
            fn.call($node, e);
            break findTarget;
          }
          $node = $node.parentNode;
          if ($node == $el) {
            break;
          }
        }
      }
    },
    false
  );
};

/**
 * export
 */
export default $;
