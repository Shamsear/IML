(function() {
  function positionTooltip(trigger, tip) {
    var r = trigger.getBoundingClientRect();
    var pad = 8;
    var tw = tip.offsetWidth;
    var th = tip.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var top, left;

    if (tip.classList.contains('tooltip-right')) {
      top = r.top + r.height / 2 - th / 2;
      left = r.right + pad;
    } else if (tip.classList.contains('tooltip-left')) {
      top = r.top + r.height / 2 - th / 2;
      left = r.left - tw - pad;
    } else {
      // Default: above the trigger
      top = r.top - th - pad;
      left = r.left + r.width / 2 - tw / 2;
    }

    // Clamp to viewport
    if (left < pad) left = pad;
    if (left + tw > vw - pad) left = vw - tw - pad;
    if (top < pad) {
      // Flip below if no room above
      top = r.bottom + pad;
    }
    if (top + th > vh - pad) top = vh - th - pad;

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  document.addEventListener('mouseover', function(e) {
    var trigger = e.target.closest('.has-tooltip');
    if (!trigger) return;
    var tip = trigger.querySelector('.tooltip-box');
    if (!tip) return;
    positionTooltip(trigger, tip);
  });

  document.addEventListener('mouseout', function(e) {
    var trigger = e.target.closest('.has-tooltip');
    if (!trigger) return;
    var tip = trigger.querySelector('.tooltip-box');
    if (!tip) return;
    tip.style.top = '';
    tip.style.left = '';
  });
})();
