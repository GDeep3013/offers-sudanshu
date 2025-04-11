import {Link, useNavigate} from '@remix-run/react';
import {AddToCartButton} from './AddToCartButton';
import {useAside} from './Aside';
import {BuyNowButton, CartProvider} from '@shopify/hydrogen-react';
import { redirect } from '@remix-run/node';

export async function action({ request, context }) {
    const { storefront } = context;
    const formData = await request.formData();

    // Extract the variant ID from the form data
    const variantId = formData.get('variantId');
    const quantity = formData.get('quantity') || 1;

    // Create a cart if one doesn't exist, or add to existing cart
    const cartId = formData.get('cartId');
    let cart;
    console.log('cart.card ID', cartId)

    if (cartId) {
        // Add to existing cart
        cart = await storefront.mutate(ADD_LINES_MUTATION, {
            variables: {
                cartId,
                lines: [{ merchandiseId: variantId, quantity: parseInt(quantity) }],
            },
        });
    } else {
        // Create a new cart
        cart = await storefront.mutate(CREATE_CART_MUTATION, {
            variables: {
                input: {
                    lines: [{ merchandiseId: variantId, quantity: parseInt(quantity) }],
                },
            },
        });
    }

    // Redirect to checkout
    console.log('cart.cartCreate', cart.cartCreate, cart.cartCreate?.cart)
    if (cart.cartCreate?.cart?.checkoutUrl || cart.cartLinesAdd?.cart?.checkoutUrl) {
        return redirect(cart.cartCreate?.cart?.checkoutUrl || cart.cartLinesAdd?.cart?.checkoutUrl);
    }

    // If something went wrong, redirect back to the product page
    return null;
}

// GraphQL mutations
const CREATE_CART_MUTATION = `#graphql
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
    }
  }
`;

const ADD_LINES_MUTATION = `#graphql
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
      }
    }
  }
`;

/**
 * @param {{
 *   productOptions: MappedProductOptions[];
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 * }}
 */
export function ProductForm({productOptions, selectedVariant}) {
    const navigate = useNavigate();
    const {open} = useAside();
    return (
        <CartProvider
            onLineAdd={() => {
                console.log('a line is being added');
            }}
            onLineAddComplete={() => {
                console.log('a line has been added');
            }}
        >
            <div className="product-form">
                {productOptions.map((option) => {
                    // If there is only a single value in the option values, don't display the option
                    if (option.optionValues.length === 1) return null;

                    return (
                        <div className="product-options" key={option.name}>
                            <h5>{option.name}</h5>
                            <div className="product-options-grid">
                                {option.optionValues.map((value) => {
                                    const {
                                        name,
                                        handle,
                                        variantUriQuery,
                                        selected,
                                        available,
                                        exists,
                                        isDifferentProduct,
                                        swatch,
                                    } = value;

                                    if (isDifferentProduct) {
                                        // SEO
                                        // When the variant is a combined listing child product
                                        // that leads to a different url, we need to render it
                                        // as an anchor tag
                                        return (
                                            <Link
                                                className="product-options-item"
                                                key={option.name + name}
                                                prefetch="intent"
                                                preventScrollReset
                                                replace
                                                to={`/products/${handle}?${variantUriQuery}`}
                                                style={{
                                                    border: selected
                                                        ? '1px solid black'
                                                        : '1px solid transparent',
                                                    opacity: available ? 1 : 0.3,
                                                }}
                                            >
                                                <ProductOptionSwatch swatch={swatch} name={name} />
                                            </Link>
                                        );
                                    } else {
                                        // SEO
                                        // When the variant is an update to the search param,
                                        // render it as a button with javascript navigating to
                                        // the variant so that SEO bots do not index these as
                                        // duplicated links
                                        return (
                                            <button
                                                type="button"
                                                className={`product-options-item${
                                                    exists && !selected ? ' link' : ''
                                                }`}
                                                key={option.name + name}
                                                style={{
                                                    border: selected
                                                        ? '1px solid black'
                                                        : '1px solid transparent',
                                                    opacity: available ? 1 : 0.3,
                                                }}
                                                disabled={!exists}
                                                onClick={() => {
                                                    if (!selected) {
                                                        navigate(`?${variantUriQuery}`, {
                                                            replace: true,
                                                            preventScrollReset: true,
                                                        });
                                                    }
                                                }}
                                            >
                                                <ProductOptionSwatch swatch={swatch} name={name} />
                                            </button>
                                        );
                                    }
                                })}
                            </div>
                            <br />
                        </div>
                    );
                })}
                <AddToCartButton
                    disabled={!selectedVariant || !selectedVariant.availableForSale}
                    onClick={() => {
                        open('cart');
                    }}
                    lines={
                        selectedVariant
                            ? [
                                {
                                    merchandiseId: selectedVariant.id,
                                    quantity: 1,
                                    selectedVariant,
                                },
                            ]
                            : []
                    }
                >
                    {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
                </AddToCartButton>

                <BuyNowButton
                    variantId={selectedVariant.id}
                    quantity={1}
                >
                    <span>Buy Now</span>
                </BuyNowButton>
            </div>
        </CartProvider>
    );
}

/**
 * @param {{
 *   swatch?: Maybe<ProductOptionValueSwatch> | undefined;
 *   name: string;
 * }}
 */
function ProductOptionSwatch({swatch, name}) {
    const image = swatch?.image?.previewImage?.url;
    const color = swatch?.color;

    if (!image && !color) return name;

    return (
        <div
            aria-label={name}
            className="product-option-label-swatch"
            style={{
                backgroundColor: color || 'transparent',
            }}
        >
            {!!image && <img src={image} alt={name} />}
        </div>
    );
}

/** @typedef {import('@shopify/hydrogen').MappedProductOptions} MappedProductOptions */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').Maybe} Maybe */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').ProductOptionValueSwatch} ProductOptionValueSwatch */
/** @typedef {import('storefrontapi.generated').ProductFragment} ProductFragment */