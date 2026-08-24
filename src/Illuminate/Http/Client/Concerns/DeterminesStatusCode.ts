import { RuntimeException } from "Illuminate/Exception";
import { Trait } from "Illuminate/Support/Traits/Trait";
import type { Constructor } from "Illuminate/Support/Traits/Trait";

/**
 * PHP: `trait Illuminate\Http\Client\Concerns\DeterminesStatusCode`.
 *
 * The status codes stay as they are in PHP even though nothing here speaks
 * HTTP: they are the vocabulary the whole request cycle is written in, and a
 * client that already knows what a 429 means needs no second one.
 *
 * `notModified()` and the redirect codes are kept for completeness; nothing in
 * the port answers with them.
 */
export function DeterminesStatusCode<TBase extends Constructor>(
    Base: TBase = Trait as never,
) {
    return class extends Base {
        /** PHP: provided by the class using the trait. */
        public status(): number {
            throw new RuntimeException(
                "A class using DeterminesStatusCode must implement status().",
            );
        }

        /** PHP: provided by the class using the trait. */
        public body(): unknown {
            throw new RuntimeException(
                "A class using DeterminesStatusCode must implement body().",
            );
        }

        /** Determine if the response code was 200 "OK" response. */
        public ok(): boolean {
            return this.status() === 200;
        }

        /** Determine if the response code was 201 "Created" response. */
        public created(): boolean {
            return this.status() === 201;
        }

        /** Determine if the response code was 202 "Accepted" response. */
        public accepted(): boolean {
            return this.status() === 202;
        }

        /**
         * Determine if the response code was the given status code and the body
         * has no content.
         */
        public noContent(status = 204): boolean {
            return this.status() === status && this.body() === undefined;
        }

        /** Determine if the response code was a 301 "Moved Permanently". */
        public movedPermanently(): boolean {
            return this.status() === 301;
        }

        /** Determine if the response code was a 302 "Found" response. */
        public found(): boolean {
            return this.status() === 302;
        }

        /** Determine if the response was a 304 "Not Modified" response. */
        public notModified(): boolean {
            return this.status() === 304;
        }

        /** Determine if the response was a 400 "Bad Request" response. */
        public badRequest(): boolean {
            return this.status() === 400;
        }

        /** Determine if the response was a 401 "Unauthorized" response. */
        public unauthorized(): boolean {
            return this.status() === 401;
        }

        /** Determine if the response was a 402 "Payment Required" response. */
        public paymentRequired(): boolean {
            return this.status() === 402;
        }

        /** Determine if the response was a 403 "Forbidden" response. */
        public forbidden(): boolean {
            return this.status() === 403;
        }

        /** Determine if the response was a 404 "Not Found" response. */
        public notFound(): boolean {
            return this.status() === 404;
        }

        /** Determine if the response was a 408 "Request Timeout" response. */
        public requestTimeout(): boolean {
            return this.status() === 408;
        }

        /** Determine if the response was a 409 "Conflict" response. */
        public conflict(): boolean {
            return this.status() === 409;
        }

        /** Determine if the response was a 422 "Unprocessable Content" response. */
        public unprocessableContent(): boolean {
            return this.status() === 422;
        }

        /** Determine if the response was a 422 "Unprocessable Entity" response. */
        public unprocessableEntity(): boolean {
            return this.unprocessableContent();
        }

        /** Determine if the response was a 429 "Too Many Requests" response. */
        public tooManyRequests(): boolean {
            return this.status() === 429;
        }
    };
}
