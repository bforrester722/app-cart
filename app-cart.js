
import {AppElement, html} from '@smyd/app-shared/app-element.js';
import {currency} from '@smyd/app-functions/lambda.js';
import {listen}   from '@smyd/app-functions/utils.js';
import services   from '@smyd/app-functions/services.js';
import htmlString from './app-cart.html';
import '@smyd/app-overlays/app-header-overlay.js';
import '@smyd/braintree-badge/braintree-badge.js';
import '@polymer/paper-button/paper-button.js';


class AppCart extends AppElement {
  static get is() { return 'app-cart'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      buttonText: {
        type: String,
        value: 'Checkout'
      },

      disabled: Boolean,

      emptyCartWords: Array,

      subtotal: Number,

      title: {
        type: String,
        value: 'My Cart'
      },

      user: Object,

      _credit: {
        type: String,
        value: '0.00'
      },

      _items: Array, 

      _subtotal: {
        type: Object,
        computed: '__computeSubtotal(subtotal)'
      },

      _deletePayload: Object,

      _unsubscribe: Object
      
    };
  }


  static get observers() {
    return [
      '__userChanged(user)'
    ];
  }


  connectedCallback() {
    super.connectedCallback();

    listen(this.$.slot,    'slotchange',    this.__slotChangedHandler.bind(this));
    listen(this.$.overlay, 'overlay-reset', this.__reset.bind(this));
  }


  __computeHideCredit(credit) {
    return !credit || Number(credit) <= 0;
  }


  __computeHiddenFlavorText(items) {
    if (!items) { return; }
    return items.length === 0 ? 'show' : '';
  }

  //items passed to change words between cart
  __computeFlavorTextWords(words, items) {
    return words[Math.floor(Math.random() * words.length)];
  }

  
  __computeSubtotal(subtotal) {
    return currency(subtotal);
  }


  __computePricingClass(subtotal) {
    return subtotal === '0.00' ? '' : 'show-subtotal';
  }

 
  __computeCheckoutButtonDisabled(subtotal, disabled) {
    return Boolean(subtotal === '0.00') || disabled;
  }


  __reset() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = undefined;
      this._credit      = '0.00';
    }
  }

  // pull user data from db
  __userChanged(user) {
    if (user) {
      const callback = dbVal => {
        this._credit = dbVal.credit;
      };

      const errorCallback = error => {
        this._credit = '0.00';
        if (
          error.message && 
          error.message === 'document does not exist'
        ) { return; }
        console.error(error);
      };

      this._unsubscribe = services.subscribe({
        callback,
        coll: `users/${user.uid}/credit`,
        doc:  'asg',
        errorCallback
      });
    }
    else {
      this.__reset();
    }
  }


  __slotChangedHandler() {
    const nodes = this.slotNodes('#slot');
    this._items = nodes.filter(node => 
      node.tagName !== undefined && node.tagName !== 'DOM-REPEAT');
    this.__resetAnimation(this._items);
  }

  // transitions lower items when item is removed from cart
  __resetAnimation(items) {
    this.$.belowRepeaterContent.style.transition = 'none';
    this.$.belowRepeaterContent.style.transform  = 'none';
    if (items && items.length) {
      items.forEach(item => {
        item.style.transition = 'none';
        item.style.transform  = '';
      });
    }
    // correct for a slight blip in height if this is 
    // not reset after each animaton sequence
    const {height} = this.getBoundingClientRect();
    this.style.minHeight = `${height}px`;
  }

  // listener in main app. deletes a item in cart
  __belowRepeaterContentTransitionend(event) {
    if (event.propertyName !== 'transform') { return; }
    if (this._deletePayload === undefined) { return; }
    this.fire('cart-item-deleted', this._deletePayload);
    this._deletePayload = undefined;
  }


  deleteItem(payload) {
    const {animationIndex} = payload;
    const {height}         = this._items[animationIndex].getBoundingClientRect();
    const remainingItems   = this._items.slice(animationIndex + 1);
    this._deletePayload    = payload;    
    this.$.belowRepeaterContent.style.transform  = `translateY(${-height}px)`;
    if (remainingItems.length) {
      remainingItems.forEach((item, index) => {
        const delay = index ? index / 20 : 0; // cascaded effect
        item.style.transition = `transform 0.3s var(--app-ease) ${delay}s`;
        item.style.transform  = `translateY(${-height}px)`;
      });
      const finalDelay = remainingItems.length / 20; // cascaded effect
      this.$.belowRepeaterContent.style.transition = `transform 0.3s var(--app-ease) ${finalDelay}s`;
    } 
    else {
      this.$.belowRepeaterContent.style.transition = 'transform 0.3s var(--app-ease)';
    }
  }


  async __continueShoppingButtonClicked(event) {
    try {
      await this.clicked();
      this.$.overlay.close();
    }
    catch (error) { 
      if (error === 'click debounced') { return; }
      console.error('__continueShoppingButtonClicked error: ', error); 
    }
  }


  async __checkoutButtonClicked() {
    try {
      await this.clicked();
      this.fire('cart-checkout-button-clicked', {subtotal: this._subtotal});
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error('__checkoutButtonClicked error', error);
    }
  }


  open() {
    return this.$.overlay.open();
  }


  reset() {
    this.__reset();
    return this.$.overlay.reset();
  }

}

window.customElements.define(AppCart.is, AppCart);
