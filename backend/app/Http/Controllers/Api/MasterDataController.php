<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\Warehouse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MasterDataController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $query = Product::with(['category', 'brand', 'unit', 'variants', 'stocks.warehouse']);

        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)
                    ->orWhere('sku', 'like', $term)
                    ->orWhere('barcode', 'like', $term);
            });
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', (int) $request->input('category_id'));
        }

        return response()->json(['data' => $query->orderBy('name')->get()]);
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'sku' => ['required', 'string', 'max:64', 'unique:products,sku'],
            'barcode' => ['nullable', 'string', 'max:80', 'unique:products,barcode'],
            'name' => ['required', 'string', 'max:180'],
            'category_id' => ['required', 'exists:categories,id'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'unit_id' => ['required', 'exists:units,id'],
            'description' => ['nullable', 'string'],
            'cost_price' => ['required', 'numeric', 'min:0'],
            'selling_price' => ['required', 'numeric', 'min:0'],
            'min_stock' => ['sometimes', 'integer', 'min:0'],
            'max_stock' => ['sometimes', 'integer', 'min:0'],
            'reorder_point' => ['sometimes', 'integer', 'min:0'],
            'lead_time_days' => ['sometimes', 'integer', 'min:1'],
            'safety_stock' => ['sometimes', 'integer', 'min:0'],
            'taxable' => ['sometimes', 'boolean'],
        ]);

        $product = Product::create($validated);

        return response()->json(['data' => $product->load(['category', 'brand', 'unit'])], 201);
    }

    public function updateProduct(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:180'],
            'category_id' => ['sometimes', 'exists:categories,id'],
            'brand_id' => ['nullable', 'exists:brands,id'],
            'unit_id' => ['sometimes', 'exists:units,id'],
            'cost_price' => ['sometimes', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'numeric', 'min:0'],
            'min_stock' => ['sometimes', 'integer', 'min:0'],
            'reorder_point' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $product->update($validated);

        return response()->json(['data' => $product->fresh()->load(['category', 'brand', 'unit'])]);
    }

    public function categories(): JsonResponse
    {
        return response()->json(['data' => Category::orderBy('name')->get()]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', 'unique:categories,code'],
            'name' => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'exists:categories,id'],
            'description' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => Category::create($validated)], 201);
    }

    public function brands(): JsonResponse
    {
        return response()->json(['data' => Brand::orderBy('name')->get()]);
    }

    public function units(): JsonResponse
    {
        return response()->json(['data' => Unit::orderBy('name')->get()]);
    }

    public function warehouses(): JsonResponse
    {
        return response()->json(['data' => Warehouse::orderBy('code')->get()]);
    }

    public function suppliers(): JsonResponse
    {
        return response()->json(['data' => Supplier::orderBy('name')->get()]);
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', 'unique:suppliers,code'],
            'name' => ['required', 'string', 'max:160'],
            'contact_person' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:160'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:80'],
            'npwp' => ['nullable', 'string', 'max:40'],
            'payment_terms_days' => ['sometimes', 'integer', 'min:0'],
        ]);

        return response()->json(['data' => Supplier::create($validated)], 201);
    }

    public function customers(): JsonResponse
    {
        return response()->json(['data' => Customer::orderBy('name')->get()]);
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', 'unique:customers,code'],
            'name' => ['required', 'string', 'max:160'],
            'type' => ['sometimes', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:160'],
            'phone' => ['nullable', 'string', 'max:32'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:80'],
            'npwp' => ['nullable', 'string', 'max:40'],
            'credit_limit' => ['sometimes', 'numeric', 'min:0'],
        ]);

        return response()->json(['data' => Customer::create($validated)], 201);
    }
}
