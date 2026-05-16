{%- set site_url = config.url %}
{%- set site_home_url = site_url + '/' %}
{%- set page_image = page.cover or page.thumbnail or site_url + '/images/site-cover.jpg' %}

<meta name="author" content="{{ config.author | escape }}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:image" content="{{ page_image | escape }}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{{ page_image | escape }}">
<link rel="alternate" type="application/atom+xml" title="{{ config.title }} Atom Feed" href="{{ site_url }}/atom.xml">
<link rel="alternate" type="application/rss+xml" title="{{ config.title }} RSS Feed" href="{{ site_url }}/rss2.xml">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Blog",
  "name": {{ config.title | json }},
  "description": {{ config.description | json }},
  "url": {{ site_home_url | json }},
  "inLanguage": "zh-CN",
  "author": {
    "@type": "Person",
    "name": {{ config.author | json }}
  }
}
</script>
