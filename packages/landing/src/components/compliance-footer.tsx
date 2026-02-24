export function ComplianceFooter({ variant }: { variant: 'warm' | 'navy' }) {
  const bgClass = variant === 'warm' ? 'bg-neutral-100' : 'bg-navy-900';
  const textClass =
    variant === 'warm' ? 'text-neutral-500' : 'text-neutral-400';

  return (
    <footer className={`${bgClass} py-8`}>
      <div className="container max-w-4xl">
        <div className={`${textClass} text-xs leading-relaxed space-y-3`}>
          <p>
            ArcVest is a registered investment adviser. Information presented is
            for educational purposes only and does not constitute investment
            advice, a recommendation, or an offer to buy or sell any securities.
          </p>
          <p>
            Past performance is not indicative of future results. Investing
            involves risk, including the potential loss of principal. No
            investment strategy can guarantee a profit or protect against loss in
            periods of declining values.
          </p>
          <p>
            ArcVest acts as a fiduciary to its clients. As a fee-only adviser,
            ArcVest does not receive commissions or compensation from third
            parties for recommending financial products. All fees are paid
            directly by the client.
          </p>
          <p>
            &copy; {new Date().getFullYear()} ArcVest. All rights reserved.
            Check the background of your financial professional on{' '}
            <a
              href="https://brokercheck.finra.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
            >
              FINRA BrokerCheck
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
