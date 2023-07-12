import Link from 'next/link'

export default function Privacy() {
  return (
    <main className="bg-fancy bg-theme sm:p-4">
      <div className="shadow-theme w-full bg-white px-6 py-12 dark:bg-inherit md:mx-auto md:max-w-3xl lg:max-w-4xl lg:pb-28 lg:pt-16">
        <article className="prose prose-sm mx-auto dark:prose-invert sm:prose-base">
          <h1 className="mb-4">etoN Privacy Policy</h1>
          <div className="text-right text-sm">
            Last Update Date: July, 11 2023
          </div>

          <h2>The summary</h2>
          <p>
            We collect your information only with your consent; we only collect
            the minimum amount of personal information that is necessary to
            contact with you and to fulfill the purpose of displaying
            information for you; we don&#39;t sell it to third parties; and we
            only use it as this Privacy Statement describes.
          </p>

          <h2>What information etoN collects</h2>
          <h3>Information from website browsers</h3>
          <p>
            If you&#39;re just browsing the website, we collect the same basic
            information that most websites collect. We use common internet
            technologies, such as cookies and web server logs. This is stuff we
            collect from everybody, whether they have an account or not.
          </p>
          <p>
            If you register for an account, you give consent to that the
            information provided is sent to and stored at our servers.{' '}
            <strong>
              Only your name, email, and profile picture are stored
            </strong>
            .
            <br />
            See{' '}
            <Link
              href="https://support.google.com/accounts/answer/12921417"
              rel="noopener noreferrer nofollow"
              target="_blank"
            >
              here
            </Link>{' '}
            for what data is shared when you use Sign in with Google.
          </p>

          <h3>Why do we collect this?</h3>
          <p>
            We only collect information that is necessary to fulfill the purpose
            of your interaction with us.
          </p>

          <h3>Audit logging</h3>
          <p>
            We store an audit log for all user api actions. The access log shows
            who send which API requests to our system (like database creation,
            deletion, etc) and when, and may include the IP address from which
            the action took place.
          </p>

          <h3 id="what-not-collect">What information etoN does not collect</h3>
          <p>
            We do not intentionally collect sensitive personal information, such
            as social security numbers, genetic data, health information, or
            religious information.
          </p>
          <p>
            Although etoN does not request or intentionally store any sensitive
            personal information, we realize that you might store this kind of
            information in Note.
            <br /> We automatically encrypt the title and body of your Note on
            our server to protect your data.
            <br /> If you use Note to store any sensitive personal information,
            you are consenting to our storage of that encrypted information on
            our servers.
          </p>

          <h3>How we share the information we collect</h3>
          <p>
            We <strong>do not</strong> share, sell, rent, or trade User Personal
            Information with third parties for their commercial purposes.
          </p>

          <p>
            We do not disclose User Personal Information outside etoN, except in
            the situations listed in this section or in the section below on{' '}
            <Link href="#compelled-disclosure">Compelled Disclosure</Link>.
          </p>

          <p>
            We do share certain aggregated, non-personally identifying
            information with others about how our users, collectively, use etoN,
            or how our users respond to our other offerings. However, we do not
            sell this information to advertisers or marketers.
          </p>

          <p>
            We may share User Personal Information if we are involved in a
            merger, sale, or acquisition. If any such change of ownership
            happens, we will ensure that it is under terms that preserve the
            confidentiality of User Personal Information, and we will notify you
            on our website or by email before any transfer of your User Personal
            Information. The organization receiving any User Personal
            Information will have to honor any promises we have made in our
            Privacy Statement
          </p>

          <h2>How etoN secures your information</h2>
          <p>
            As mentioned on{' '}
            <Link href="#what-not-collect">
              What information etoN does not collect
            </Link>{' '}
            section, we automatically encrypt the title and body of your Note on
            our server to protect your data.
          </p>

          <h2 id="compelled-disclosure">
            How we respond to compelled disclosure
          </h2>
          <p>
            etoN may disclose personally-identifying information or other
            information we collect about you to law enforcement in response to a
            valid subpoena, court order, warrant, or similar government order,
            or when we believe in good faith that disclosure is reasonably
            necessary to protect our property or rights, or those of third
            parties or the public at large. In complying with court orders and
            similar legal processes, etoN strives for transparency. When
            permitted, we will make a reasonable effort to notify users of any
            disclosure of their information, unless we are prohibited by law or
            court order from doing so, or in rare, exigent circumstances
          </p>

          <h2>Your rights to access and control the information we collect</h2>
          <p>
            If you&#39;re already a etoN user, you may access, or delete your
            basic user profile information by deleting your basic user profile
            information.
          </p>
          <p>
            You have the right to request etoN for copies of your personal data.
            You have the right to request that etoN correct any information you
            believe is inaccurate. You also have the right to request etoN to
            complete the information you believe is incomplete
          </p>
          <p>
            As mentioned above, you have the right to request that etoN erase
            your Personal Information. You can achieve this by deleting your
            basic user profile information. Further, you have the right to
            object to any of etoN&#39;s data policies and how we use your
            Personal Information. Please contact us to inform us of any
            objections so we can take appropriate remedial steps.
          </p>
          <p>
            You have the right to request that etoN transfer your Personal
            Information and Content that we have collected to another
            organization, or directly to you. Please contact us to make such a
            request.
          </p>

          <h3>Data Retention and Deletion</h3>
          <p>
            etoN will retain User Personal Information for as long as your
            account is active or as needed to provide you services.
            <br /> We may retain certain User Personal Information indefinitely,
            unless you request its deletion.
            <br /> If you would like to cancel your account or delete your User
            Personal Information, you may do so by deleting your account or
            contact us. We will retain and use your information as necessary to
            comply with our legal obligations, resolve disputes, and enforce our
            agreements, but barring legal requirements, we will delete your full
            profile (within reason) within 30 days.
          </p>
        </article>
      </div>
    </main>
  )
}
