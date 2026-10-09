import { notFound } from "next/navigation";
import { ProductForm } from "@/components/ProductForm";
import { PageHeader } from "@/components/ui";
import { getRepo } from "@/lib/db";

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  const { id } = await params;
  const repo = await getRepo();
  const [product, settings] = await Promise.all([repo.getProduct(id), repo.getSettings()]);
  if (!product) notFound();
  return (
    <>
      <PageHeader title="商品を編集" description={product.title} />
      <ProductForm settings={settings} product={product} />
    </>
  );
}
