---
layout: post
title: JS实现常见的十大排序算法
subtitle: JS实现常见的十大排序算法
date: 2023-06-08
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: 常见的排序算法
---

# JS实现常见的十大排序算法

## 学习排序算法的目的

1. 解决实际问题：排序算法是计算机科学中的基础算法之一，几乎在任何领域的软件开发中都会遇到排序的需求。了解各种排序算法能够帮助程序员解决实际问题，提供高效的数据处理和查询功能。

2. 性能优化：排序算法的选择会对程序的性能产生直接影响。不同的排序算法在时间复杂度和空间复杂度上有不同的特点，了解不同排序算法的性能特点可以帮助程序员选择最适合的算法，优化程序的执行效率。

3. 数据结构：排序算法与数据结构密切相关。对于不同类型的数据结构，选择合适的排序算法能够充分发挥数据结构的优势，提高数据处理的效率。例如，对于链表结构，插入排序可能更加适用，而对于数组结构，快速排序或堆排序可能更高效。

4. 算法设计和分析：排序算法是算法设计和分析的经典案例之一。通过学习排序算法，程序员可以培养良好的算法设计思维，学会分析和评估算法的性能，提高解决问题的能力。

5. 面试准备：排序算法是面试中常见的考点之一。许多技术面试会涉及排序算法的实现和性能分析，熟悉排序算法可以帮助程序员在面试中更好地展示自己的技术能力。

总之，学习排序算法对程序员来说是非常重要的，它不仅能提升解决问题的能力和算法设计思维，还能优化程序性能，为面试做好准备。

## 常见的排序算法

常见的排序算法有以下几种：

1. 冒泡排序（Bubble Sort）：比较相邻元素的大小，如果逆序则交换，每一轮将最大的元素冒泡到最后。时间复杂度为O(n^2)。

2. 选择排序（Selection Sort）：每次从未排序的部分选择最小的元素，放到已排序部分的末尾。时间复杂度为O(n^2)。

3. 插入排序（Insertion Sort）：将未排序的元素逐个插入到已排序部分的合适位置，时间复杂度为O(n^2)。

4. 快速排序（Quick Sort）：选取一个基准元素，将比基准小的元素放在左边，比基准大的元素放在右边，然后对左右两边递归地进行快速排序。平均时间复杂度为O(nlogn)。

5. 归并排序（Merge Sort）：将待排序数组不断二分为两个子数组，分别进行排序，然后将两个有序的子数组合并成一个有序数组。时间复杂度为O(nlogn)。

6. 堆排序（Heap Sort）：利用二叉堆数据结构进行排序。首先构建最大堆，然后将堆顶元素与最后一个元素交换，然后调整堆，再重复该过程，最终得到有序序列。时间复杂度为O(nlogn)。

7. 希尔排序（Shell Sort）：将待排序数组按照一定增量分组，对每个分组进行插入排序，然后逐渐缩小增量，直到增量为1，最后进行一次插入排序。时间复杂度取决于增量序列的选择。

8. 计数排序（Counting Sort）：适用于待排序元素范围较小的情况，统计每个元素出现的次数，然后根据统计结果进行排序。时间复杂度为O(n+k)，其中k为元素的范围。

9. 桶排序（Bucket Sort）：将待排序元素分配到不同的桶中，对每个桶中的元素进行排序，最后按顺序将桶中的元素依次取出。时间复杂度取决于桶的数量和元素分布的均匀程度。

10. 基数排序（Radix Sort）：按照元素的位数进行排序，从低位到高位依次进行排序，每一位使用稳定的排序算法。时间复杂度为O(d*(n+k))，其中d为最大元素的位数，k为基数。

这些排序算法各有优劣，适用于不同的场景和数据规模。选择合适的排序算法可以提高排序效率。

## 冒泡排序

冒泡排序（Bubble Sort）是一种简单的排序算法，它重复地遍历要排序的列表，依次比较相邻的两个元素，并按照升序或降序交换它们的位置，直到整个列表排序完成。

实现原理：

1. 从列表的第一个元素开始，将其与下一个元素比较，如果顺序错误（升序时当前元素大于下一个元素，降序时当前元素小于下一个元素），则交换它们的位置。
2. 继续比较下一个相邻元素，重复上述步骤，直到遍历到列表的最后一个元素。
3. 重复步骤1和2，直到没有任何元素需要交换位置，即列表已排序完成。

示例代码：

```javascript
// 普通实现
function bubbleSort(arr) {
  const len = arr.length;
  
  // 外层循环控制比较的轮数
  for (let i = 0; i < len - 1; i++) {
    
    // 内层循环进行相邻元素的比较和交换
    for (let j = 0; j < len - 1 - i; j++) {
      
      // 如果前面的元素大于后面的元素，则交换它们的位置
      if (arr[j] > arr[j + 1]) {
        const temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  
  return arr;
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = bubbleSort(array);
console.log(sortedArray);  // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

```javascript
// 优化实现，如果发现已经完成排序，通过标记提前退出循环
function bubbleSort(arr) {
  const len = arr.length;
  let swapped;

  // 外层循环控制排序的轮数
  for (let i = 0; i < len - 1; i++) {
    swapped = false;

    // 内层循环进行相邻元素的比较和交换
    for (let j = 0; j < len - 1 - i; j++) {
      if (arr[j] > arr[j + 1]) {
        // 交换相邻元素的位置
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        swapped = true;
      }
    }

    // 如果某轮循环没有进行任何交换，则说明列表已排序完成，可以提前退出循环
    if (!swapped) {
      break;
    }
  }

  return arr;
}

// 测试
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
console.log(bubbleSort(array));  // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

时间复杂度：冒泡排序的时间复杂度为O(n^2)，其中n是要排序的元素数量。最好情况下，如果列表已经有序，冒泡排序的时间复杂度可以优化到O(n)，通过增加一个标志位来判断是否发生交换，提前结束循环。
空间复杂度：冒泡排序的空间复杂度为 O(1)，即不需要额外的存储空间。
稳定性：冒泡排序是一种稳定的排序算法，相等元素的相对顺序在排序前后不会改变。

使用场景：

冒泡排序是一种简单但效率较低的排序算法，适用于小规模的列表。在大规模数据的情况下，其他高效的排序算法（如快速排序、归并排序）更常被使用。然而，冒泡排序在某些特殊情况下可能会有其用武之地，例如当输入列表几乎已经有序时，冒泡排序可能会比其他算法更加高效。

## 选择排序

选择排序（Selection Sort）是一种简单直观的排序算法，它的原理是每一轮从待排序的元素中选择最小（或最大）的元素，将其与序列中的第一个元素交换位置，然后再从剩下的元素中选择最小（或最大）的元素，与序列中的第二个元素交换位置，以此类推，直到整个序列有序。

示例代码：

```javascript
function selectionSort(arr) {
  const len = arr.length;
  
  for (let i = 0; i < len - 1; i++) {
    let minIndex = i; // 假设当前索引为最小索引

    // 在剩余未排序的元素中找到最小值的索引
    for (let j = i + 1; j < len; j++) {
      if (arr[j] < arr[minIndex]) {
        minIndex = j; // 更新最小索引
      }
    }

    // 将最小值与当前位置交换
    if (minIndex !== i) {
      [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
    }
  }
  
  return arr;
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = selectionSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：选择排序的时间复杂度为 O(n^2)，其中 n 是待排序数组的长度。每一轮需要从未排序区中选择最小元素，共需要进行 (n-1) + (n-2) + ... + 1 = n*(n-1)/2 次比较。
- 空间复杂度：选择排序的空间复杂度为 O(1)，即不需要额外的存储空间。
- 稳定性：选择排序是一种不稳定的排序算法，相等元素的相对顺序在排序过程中可能发生改变。

使用场景：

由于选择排序的时间复杂度较高，对于大规模数据的排序效率较低，因此在实际应用中并不常用。更适合在小规模或部分有序的数组中使用。选择排序的优点是实现简单、思路清晰，且对于输入数据的初始顺序不敏感。然而，对于大规模的数据集，选择排序的效率较低，因为其时间复杂度较高。在实际应用中，更常使用快速排序、归并排序等更高效的排序算法。

## 插入排序

插入排序（Insertion Sort）是一种简单直观的排序算法，它的原理是将待排序的元素逐个插入到已排序序列中的合适位置，直到整个序列有序。

实现原理：

1. 遍历待排序数组，将当前元素视为待插入元素。
2. 在已排序序列中，从后往前逐个比较元素，如果当前元素大于待插入元素，则将该元素后移一位。
3. 重复上述步骤，直到找到待插入元素的正确位置。
4. 将待插入元素插入到正确位置。

示例代码：

```javascript
function insertionSort(arr) {
  const len = arr.length;

  for (let i = 1; i < len; i++) {
    const current = arr[i]; // 当前待插入的元素
    let j = i - 1; // 已排序序列的最后一个元素的索引

    // 将比current大的元素向后移动，为current找到合适的插入位置
    while (j >= 0 && arr[j] > current) {
      arr[j + 1] = arr[j]; // 元素后移
      j--;
    }

    arr[j + 1] = current; // 将current插入到正确的位置
  }

  return arr;
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = insertionSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：插入排序的时间复杂度为O(n^2)，其中n是待排序数组的长度。在最坏情况下，需要进行n次比较和移动操作，因此时间复杂度是二次的。
- 空间复杂度：插入排序的空间复杂度为O(1)，它只需要使用常数级别的额外空间进行元素的比较和移动。
- 稳定性：插入排序是一种稳定的排序算法，即相同值的元素在排序过程中不会改变相对顺序。

使用场景：

插入排序适用于小规模或部分有序的数组。当待排序数组基本有序时，插入排序的效率较高。它比冒泡排序和选择排序的性能稍好，且实现简单，适用于对于数据量较小的排序任务。插入排序也可以用作其他高级排序算法的子过程，例如快速排序的优化版本中的小数组排序。

## 快速排序

快速排序（Quick Sort）是一种高效的排序算法，它的原理是通过选择一个基准元素，将数组分割成较小和较大两个子数组，然后对子数组进行递归排序，直到整个数组有序。

实现原理：

1. 选择一个基准元素（通常是数组中的中间元素）。
2. 将数组分成两个子数组，比基准元素小的放在左边，比基准元素大的放在右边。
3. 递归地对左右子数组进行快速排序。
4. 合并左子数组、基准元素和右子数组，得到最终有序的数组。

示例代码：

普通实现

```javascript
// 普通实现
function quickSort(arr) {
  if (arr.length <= 1) {
    return arr; // 基线条件：数组为空或只有一个元素，直接返回
  }

  const pivotIndex = Math.floor(arr.length / 2); // 选择基准元素的索引
  const pivot = arr.splice(pivotIndex, 1)[0]; // 从数组中取出基准元素

  const left = [];
  const right = [];

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < pivot) {
      left.push(arr[i]); // 小于基准的元素放入左子数组
    } else {
      right.push(arr[i]); // 大于等于基准的元素放入右子数组
    }
  }

  // 递归排序左右子数组，并拼接结果
  return quickSort(left).concat([pivot], quickSort(right));
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = quickSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

使用ES6简洁实现

```js
// 使用ES6简洁实现
function quickSort (arr) {
    // 如果数组长度小于2，则返回原数组
    if (arr && arr.length < 2) {
        return arr;
    }

    const [prev, ...rest] = arr; // 取数组的第一个元素作为比较基准值
    return [
        ...quickSort(rest.filter(value => value < prev)), // 筛选出比prev的值小的值放在prev的左边，然后再进行递归操作
        prev,
        ...quickSort(rest.filter(value => value >= prev)), // 筛选出比prev的值大的放在prev的右边，然后再进行递归操作
    ]
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = quickSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：快速排序的平均时间复杂度为O(nlogn)，其中n是待排序数组的长度。在最坏情况下，时间复杂度为O(n^2)，但快速排序的平均时间复杂度较低，因此它通常被认为是一种高效的排序算法。
- 空间复杂度：快速排序的空间复杂度为O(logn)，它通过递归调用和分割子数组的方式使用了额外的空间。空间复杂度主要取决于递归调用的深度。
- 稳定性：快速排序是一种不稳定的排序算法，即相同值的元素在排序过程中可能会改变相对顺序。

使用场景：

快速排序适用于大规模数据的排序，它在实际应用中被广泛使用。快速排序的优势在于排序速度快，尤其在大规模乱序数据的排序效率较高。它也是许多编程语言和库中的默认排序算法，如JavaScript中的`Array.prototype.sort()`方法就使用了快速排序算法。

## 归并排序

归并排序（Merge Sort）是一种高效的排序算法，它的原理是将待排序的数组递归地分成两个子数组，分别对子数组进行排序，然后将两个排序好的子数组合并成一个有序的数组。

实现原理：

1. 将待排序数组分割成较小的子数组，直到每个子数组只包含一个元素（递归基线条件）。
2. 递归地将子数组排序，直到得到排好序的子数组。
3. 合并排好序的子数组，得到最终有序的数组。

示例代码：

```javascript
function mergeSort(arr) {
  if (arr.length <= 1) {
    return arr; // 基线条件：数组为空或只有一个元素，直接返回
  }

  const mid = Math.floor(arr.length / 2); // 找到数组的中间位置
  const left = arr.slice(0, mid); // 分割为左子数组
  const right = arr.slice(mid); // 分割为右子数组

  return merge(mergeSort(left), mergeSort(right)); // 递归地对左右子数组进行归并排序并合并
}

// 合并两个有序数组
function merge(left, right) {
  const merged = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] < right[rightIndex]) {
      merged.push(left[leftIndex]); // 左子数组元素较小，放入合并数组
      leftIndex++;
    } else {
      merged.push(right[rightIndex]); // 右子数组元素较小，放入合并数组
      rightIndex++;
    }
  }

  // 将剩余的元素放入合并数组
  return merged.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = mergeSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：归并排序的时间复杂度为O(nlogn)，其中n是待排序数组的长度。归并排序是一种分治算法，通过将数组分成较小的子数组并对它们进行排序，然后再将排好序的子数组进行合并，从而实现整体的排序。
- 空间复杂度：归并排序的空间复杂度为O(n)，它需要额外的空间来存储临时数组以及递归调用时的堆栈空间。
- 稳定性：归并排序是一种稳定的排序算法，相同值的元素在排序过程中不会改变相对顺序。

使用场景：

归并排序适用于大规模数据的排序，特别适用于外部排序，即排序数据量大到无法全部加载到内存中的场景。归并排序的优势在于排序速度较快且稳定，对于处理大规模乱序数据或需要保持相同元素相对顺序的排序任务非常有效。

## 堆排序

堆排序（Heap Sort）是一种高效的排序算法，它利用堆这种数据结构进行排序。堆是一种特殊的完全二叉树，它满足堆的性质：对于每个节点，其值大于（或小于）其子节点的值。

实现原理：

1. 构建最大堆：从最后一个非叶子节点开始，依次将数组转换为最大堆，保证每个节点的值大于或等于其子节点的值。
2. 依次取出堆顶元素：将堆顶元素与最后一个元素交换，然后调整堆，将剩余元素重新构建为最大堆。
3. 重复上述步骤，直到堆中的所有元素都被取出并排好序。

示例代码：

```javascript
function heapSort(arr) {
  const len = arr.length;

  // 构建最大堆
  for (let i = Math.floor(len / 2) - 1; i >= 0; i--) {
    heapify(arr, len, i);
  }

  // 依次取出堆顶元素并调整堆
  for (let i = len - 1; i > 0; i--) {
    [arr[0], arr[i]] = [arr[i], arr[0]]; // 将堆顶元素与最后一个元素交换
    heapify(arr, i, 0); // 调整堆
  }

  return arr;
}

function heapify(arr, n, i) {
  let largest = i; // 当前节点索引
  const left = 2 * i + 1; // 左子节点索引
  const right = 2 * i + 2; // 右子节点索引

  // 找出最大值的索引
  if (left < n && arr[left] > arr[largest]) {
    largest = left;
  }

  if (right < n && arr[right] > arr[largest]) {
    largest = right;
  }

  // 如果最大值的索引不是当前节点，则交换节点并继续调整堆
  if (largest !== i) {
    [arr[i], arr[largest]] = [arr[largest], arr[i]];
    heapify(arr, n, largest);
  }
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = heapSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：堆排序的时间复杂度为O(nlogn)，其中n是待排序数组的长度。堆排序的构建最大堆操作和调整堆操作的时间复杂度均为O(logn)，需要执行n次，因此总体时间复杂度为O(nlogn)。
- 空间复杂度：堆排序的空间复杂度为O(1)，它只需要使用常数级别的额外空间来进行元素交换，没有使用额外的数据结构。
- 稳定性：堆排序是一种不稳定的排序算法，即相同值的元素在排序过程中可能会改变相对顺序。

使用场景：

堆排序适用于大规模数据的排序，尤其适用于需要找出最大或最小的K个元素的问题。由于堆排序的构建最大堆操作具有线性时间复杂度，因此可以在一些特定场景中提供较好的性能，如优先队列的实现、Top K 问题等。

## 希尔排序

希尔排序（Shell Sort），也称作缩小增量排序，是插入排序的一种改进版本。它通过将待排序数组分成多个子数组，并对每个子数组进行插入排序，逐步减小子数组的大小，最终完成整个数组的排序。

实现原理：

1. 选择一个初始增量（通常为数组长度的一半）。
2. 将数组分成多个子数组，每个子数组相隔增量个位置。
3. 对每个子数组进行插入排序，将子数组中的元素插入到正确的位置。
4. 逐步减小增量，重复上述步骤，直到增量为1，完成整个数组的排序。

示例代码：

```javascript
function shellSort(arr) {
  const len = arr.length;
  let gap = Math.floor(len / 2); // 初始增量

  while (gap > 0) {
    // 对每个子数组进行插入排序
    for (let i = gap; i < len; i++) {
      const temp = arr[i];
      let j = i;

      // 在子数组中进行插入排序
      while (j >= gap && arr[j - gap] > temp) {
        arr[j] = arr[j - gap];
        j -= gap;
      }

      arr[j] = temp;
    }

    gap = Math.floor(gap / 2); // 减小增量
  }

  return arr;
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = shellSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 希尔排序的时间复杂度依赖于增量序列的选择，平均时间复杂度为O(nlogn)。最坏情况下的时间复杂度与插入排序相同，为O(n^2)。
- 空间复杂度：希尔排序的空间复杂度为O(1)，它在原地进行排序，不需要额外的空间。
- 稳定性：希尔排序是一种不稳定的排序算法，即相同值的元素在排序过程中可能会改变相对顺序。
- 希尔排序的性能与增量序列的选择有关，不同的增量序列可能导致不同的性能表现。

使用场景：

希尔排序适用于中等大小的数组排序，特别适用于需要在性能和简单实现之间取得平衡的场景。它在实际应用中常用于对大型数据集进行初步排序的预处理步骤，为后续排序算法提供更好的初始状态。希尔排序相对于其他简单的初级排序算法具有更好的性能，但仍然不如快速排序、归并排序等高级排序算法。

## 计数排序

计数排序（Counting Sort）是一种线性时间复杂度的排序算法，它通过统计数组中每个元素的出现次数，然后根据统计信息将元素排序。

实现原理：

1. 首先找出数组中的最小值（min）和最大值（max）。
2. 创建一个计数数组（countArr），长度为max min + 1，并初始化为0。
3. 遍历待排序数组，统计每个元素出现的次数，并将统计结果存储在计数数组中。
4. 根据计数数组的统计结果，重构排序后的数组。

示例代码：

```javascript
function countingSort(arr) {
  const len = arr.length;

  // 找出数组中的最大值和最小值
  let min = arr[0];
  let max = arr[0];
  for (let i = 1; i < len; i++) {
    if (arr[i] < min) {
      min = arr[i];
    } else if (arr[i] > max) {
      max = arr[i];
    }
  }

  // 创建计数数组并统计元素出现次数
  const countArr = new Array(max - min + 1).fill(0);
  for (let i = 0; i < len; i++) {
    countArr[arr[i] - min]++;
  }

  // 根据计数数组重构排序后的数组
  let outputIndex = 0;
  for (let i = 0; i < countArr.length; i++) {
    while (countArr[i] > 0) {
      arr[outputIndex] = i + min;
      outputIndex++;
      countArr[i]--;
    }
  }

  return arr;
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = countingSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：计数排序的时间复杂度为O(n+k)，其中n是待排序数组的长度，k是计数范围。计数排序的时间复杂度较低，但要求待排序的元素必须是整数且范围不宜过大。
- 空间复杂度：计数排序的空间复杂度为O(k)，其中k是计数范围。计数排序需要额外的计数数组来存储每个元素出现的次数。
- 稳定性：计数排序是一种稳定的排序算法，即相同值的元素在排序过程中不会改变相对顺序。

使用场景：

计数排序适用于排序范围较小的整数数组，且待排序数组的元素取值较集中的情况。计数排序的优势在于排序速度快且稳定，特别适用于处理大量重复元素的排序任务，例如对年龄、成绩、身高等离散数据进行排序。

## 桶排序

桶排序（Bucket Sort）是一种通过将待排序元素分配到不同的桶（容器）中，对每个桶中的元素进行排序，最后将各个桶中的元素合并得到有序结果的排序算法。

实现原理：

1. 找出待排序数组的最小值和最大值，确定桶的范围。
2. 根据桶的大小，计算需要的桶的数量，并创建对应数量的桶。
3. 将待排序数组中的元素根据取值范围分配到不同的桶中。
4. 对每个桶中的元素进行排序，可以选择不同的排序算法（如插入排序、快速排序）或递归使用桶排序。
5. 将各个桶中的有序元素合并得到最终的有序结果。

示例代码：

```javascript
function bucketSort(arr, bucketSize = 5) {
  const len = arr.length;

  // 找出数组的最大值和最小值
  let min = arr[0];
  let max = arr[0];
  for (let i = 1; i < len; i++) {
    if (arr[i] < min) {
      min = arr[i];
    }
    if (arr[i] > max) {
      max = arr[i];
    }
  }

  // 计算桶的数量
  const bucketCount = Math.floor((max - min) / bucketSize) + 1;
  const buckets = new Array(bucketCount);

  // 初始化桶
  for (let i = 0; i < bucketCount; i++) {
    buckets[i] = [];
  }

  // 将元素分配到不同的桶中
  for (let i = 0; i < len; i++) {
    const bucketIndex = Math.floor((arr[i] - min) / bucketSize);
    buckets[bucketIndex].push(arr[i]);
  }

  // 对每个桶中的元素进行排序
  const sortedArray = [];
  for (let i = 0; i < bucketCount; i++) {
    // 提示：这里可以对每个桶中的元素进行插入排序或快速排序等
    // if (buckets[i]) {
    //   insertionSort(buckets[i]); // 使用插入排序对每个桶中的元素进行排序
    //   sortedArray.push(...buckets[i]); // 将排序后的桶合并到有序序列中
    // }

    if (bucketSize === 1) {
      // 桶大小为1时，直接将桶中的元素加入有序数组
      sortedArray.push(...buckets[i]);
    } else {
      // 桶大小大于1时，递归使用桶排序并将结果合并到有序数组
      const bucket = bucketSort(buckets[i], bucketSize - 1);
      sortedArray.push(...bucket);
    }
  }

  return sortedArray;
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = bucketSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：桶排序的时间复杂度取决于桶的数量和桶中元素的排序算法。在理想情况下，桶的数量越大，桶内元素越均匀分布，桶排序的时间复杂度越接近O(n)。但在最坏情况下，桶内元素都被分配到一个桶中，时间复杂度退化为O(n^2)。因此，选择合适的桶大小和排序算法对性能很重要。
- 空间复杂度：桶排序的空间复杂度为O(n+k)，其中n是待排序数组的长度，k是桶的数量。需要额外的空间来存储桶和合并有序结果。
- 稳定性：桶排序可以是稳定的，但要求在桶内进行排序时使用稳定的排序算法。

使用场景：

桶排序适用于待排序数组分布较均匀、取值范围较小的情况。它对于大量数据的排序效果较好，并且适用于外部排序（需要将数据存储在磁盘或其他外部存储介质上进行排序）的场景。桶排序常用于对年龄、成绩、价格等离散数据进行排序，特别是当数据分布较为连续时，桶排序的性能优势更加明显。

## 基数排序

基数排序（Radix Sort）是一种非比较排序算法，它根据元素的每个位上的值进行排序。基数排序可以按照个位、十位、百位等位数依次进行排序，直到最高位，从而得到有序序列。

实现原理：

1. 找出数组中的最大值，确定排序的轮数。最大值的位数决定了需要进行多少轮排序。
2. 从最低位开始，按照个位、十位、百位等位数依次进行排序。
3. 创建10个桶，分别表示0-9。将待排序数组中的元素根据当前位上的值分配到对应的桶中。
4. 按照桶的顺序将元素依次合并为一个数组。
5. 重复上述过程，直到完成所有位的排序，得到有序序列。

示例代码：

```javascript
function radixSort(arr) {
  const max = Math.max(...arr); // 找出数组中的最大值
  const maxDigitCount = countDigits(max); // 计算最大值的位数

  // 按照位数依次进行排序
  for (let i = 0; i < maxDigitCount; i++) {
    const buckets = Array.from({ length: 10 }, () => []); // 创建10个桶，分别表示0-9

    // 将元素分配到对应的桶中
    for (let j = 0; j < arr.length; j++) {
      const digit = getDigit(arr[j], i); // 获取当前位上的数字
      buckets[digit].push(arr[j]);
    }

    // 将桶中的元素按顺序合并为一个数组
    arr = [].concat(...buckets);
  }

  return arr;
}

// 计算数字的位数
function countDigits(num) {
  if (num === 0) return 1;
  return Math.floor(Math.log10(num)) + 1;
}

// 获取数字指定位上的值
function getDigit(num, place) {
  return Math.floor(Math.abs(num) / Math.pow(10, place)) % 10;
}

// 示例用法
const array = [4, 2, 2, 8, 3, 3, 10, 5, 6, 2, 3];
const sortedArray = radixSort(array);
console.log(sortedArray); // 输出: [2, 2, 2, 3, 3, 3, 4, 5, 6, 8, 10]
```

性能分析：

- 时间复杂度：基数排序的时间复杂度为O(d*(n+k))，其中n是待排序数组的长度，d是最大值的位数，k是基数（例如十进制中的10）。
- 空间复杂度：基数排序的空间复杂度为O(n+k)，其中n是待排序数组的长度，k是基数。
- 稳定性：基数排序是一种稳定的排序算法，相同值的元素在排序过程中不会改变相对顺序。

使用场景：

基数排序适用于待排序元素是非负整数的情况。
它对于位数较小的整数排序效果较好，尤其在位数相差不大的情况下。基数排序在实际应用中常用于整数排序、字符串排序和日期排序等场景。

## 总结

常见的十大排序算法的平均、最好和最差情况下的时间复杂度、空间复杂度和稳定性，汇总如下：

| 算法           | 平均时间复杂度 | 最好时间复杂度 | 最差时间复杂度 | 空间复杂度 | 稳定性 |
|----------------|---------------|---------------|---------------|------------|--------|
| 冒泡排序       | O(n^2)        | O(n)          | O(n^2)        | O(1)       | 稳定   |
| 选择排序       | O(n^2)        | O(n^2)        | O(n^2)        | O(1)       | 不稳定 |
| 插入排序       | O(n^2)        | O(n)          | O(n^2)        | O(1)       | 稳定   |
| 快速排序       | O(n log n)    | O(n log n)    | O(n^2)        | O(log n)   | 不稳定 |
| 归并排序       | O(n log n)    | O(n log n)    | O(n log n)    | O(n)       | 稳定   |
| 堆排序         | O(n log n)    | O(n log n)    | O(n log n)    | O(1)       | 不稳定 |
| 希尔排序       | O(n log n)    | O(n log^2 n)  | O(n log^2 n)  | O(1)       | 不稳定 |
| 计数排序       | O(n + k)      | O(n + k)      | O(n + k)      | O(n + k)   | 稳定   |
| 桶排序         | O(n + k)      | O(n + k)      | O(n^2)        | O(n + k)   | 稳定   |
| 基数排序       | O(n * k)      | O(n * k)      | O(n * k)      | O(n + k)   | 稳定   |

其中，n 表示数组的长度，k 表示待排序元素的取值范围大小。

需要注意的是，表中的时间复杂度和空间复杂度仅代表了排序算法的大致性能，具体的实现方式和优化方法可能会对实际性能产生影响。此外，稳定性指的是排序算法在排序过程中是否保持相同元素的相对顺序不变。

选择适合的排序算法取决于具体的应用场景和对性能要求的考虑。例如，对于大规模数据的排序，快速排序和归并排序通常是较好的选择；对于需要稳定排序的情况，可以考虑插入排序、归并排序或计数排序等。在实际应用中，也可以根据数据规模、元素分布特点等因素进行综合考虑，选择最合适的排序算法。

## 引申

我们平时工作当中排序使用的最多的应该是数组的`sort`方法，那么`sort`方法具体的实现原理大家有了解过嘛？

`sort`方法详细用法参考mdn文档：https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/sort

参考：https://www.xiabingbao.com/post/sort/javascript-10-sort.html